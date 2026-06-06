import Store from "../Schema/Store.js";
import { blockDisposableEmail } from "../Utils/disposableEmail.js";
import { logger } from "../Utils/logger.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  generateOTP,
  sendOTPEmail,
  otpExpiryMs,
} from "../Utils/otpManager.js";
import { constantTimeCompare } from "../Utils/crypto.js";
import { revokeAllSessions } from "../Utils/sessionManager.js";
import {
  createLinkedAccount,
  fetchLinkedAccount,
  mapRazorpayAccountStatus,
  requestRouteProduct,
} from "../Services/razorpayAccountService.js";
import { ROLES } from "../../config/constants.js";

function assertAdmin(req, res) {
  if (req.role !== ROLES.ADMIN) {
    sendError(res, 403, "Forbidden", "Admin role required");
    return false;
  }
  return true;
}

export async function createStoreByAdmin(req, res) {
  const {
    name,
    phone,
    email,
    password,
    address,
    location,
    upiId,
    cuisineTypes,
    owner,
    commissionPercent,
  } = req.validated;

  const blocked = blockDisposableEmail(res, email, "admin-create-store");
  if (blocked) return blocked;

  const dup = await Store.findOne({
    $or: [{ phone }, { email: email.toLowerCase() }],
  });
  if (dup) {
    return sendError(
      res,
      409,
      "Conflict",
      "Store phone or email already registered"
    );
  }

  try {
    const store = await Store.create({
      name,
      phone,
      email,
      password,
      address,
      location,
      upiId,
      cuisineTypes,
      owner,
      isVerified: true,
      bankDetails: upiId ? { upiId } : undefined,
      razorpay:
        commissionPercent != null ? { commissionPercent } : undefined,
    });

    logger.info("admin provisioned store", {
      adminId: req.userId,
      storeId: store._id,
      email: store.email,
    });

    return sendSuccess(res, 201, {
      store: store.toJSON(),
      message: "Store provisioned. Share credentials with owner.",
    });
  } catch (err) {
    logger.error("admin createStore failed", { error: err.message });
    throw err;
  }
}

export async function listStores(req, res) {
  const { verified } = req.query || {};
  const filter = {};
  if (verified === "true") filter.isVerified = true;
  if (verified === "false") filter.isVerified = false;
  const stores = await Store.find(filter)
    .select(
      "_id name email phone isVerified isActive location address owner createdAt"
    )
    .sort({ createdAt: -1 })
    .limit(200);
  return sendSuccess(res, 200, { stores });
}

export async function getStoreById(req, res) {
  const store = await Store.findById(req.params.id);
  if (!store) return sendError(res, 404, "Not found", "Store not found");
  const json = store.toJSON();
  json.lastLogin = store.lastLogin || null;
  json.subscriptionStatus = store.subscriptionStatus;
  json.sessions = (store.sessions || []).map((s) => ({
    tokenId: s.tokenId,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    revokedAt: s.revokedAt || null,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    deviceName: s.deviceName,
  }));
  return sendSuccess(res, 200, { store: json });
}

export async function verifyStore(req, res) {
  const updated = await Store.findByIdAndUpdate(
    req.params.id,
    { $set: { isVerified: true } },
    { new: true }
  );
  if (!updated) {
    return sendError(res, 404, "Not found", "Store not found");
  }
  return sendSuccess(res, 200, {
    store: updated.toJSON(),
    message: "Store verified",
  });
}

export async function deactivateStore(req, res) {
  if (!assertAdmin(req, res)) return;
  const store = await Store.findById(req.params.id);
  if (!store) {
    return sendError(res, 404, "Not found", "Store not found");
  }
  store.isActive = false;
  store.credentialsVersion = (store.credentialsVersion || 0) + 1;
  revokeAllSessions(store);
  await store.save();
  logger.info("admin deactivated store + revoked sessions", {
    adminId: req.userId,
    storeId: store._id,
  });
  return sendSuccess(res, 200, {
    store: store.toJSON(),
    message: "Store deactivated",
  });
}

export async function activateStore(req, res) {
  const updated = await Store.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: true } },
    { new: true }
  );
  if (!updated) {
    return sendError(res, 404, "Not found", "Store not found");
  }
  return sendSuccess(res, 200, {
    store: updated.toJSON(),
    message: "Store activated",
  });
}

export async function sendStoreEmailOTP(req, res) {
  const store = await Store.findById(req.params.id);
  if (!store) return sendError(res, 404, "Not found", "Store not found");

  const otp = generateOTP();
  store.emailVerificationOTP = otp;
  store.emailVerificationExpiry = new Date(Date.now() + otpExpiryMs());
  store.emailVerificationAttempts = 0;
  await store.save();

  await sendOTPEmail(store.email, otp, store.owner?.name || store.name);
  logger.info("admin sent store email OTP", { storeId: store._id });

  return sendSuccess(res, 200, {
    message: "Verification code sent to store email",
    expiresIn: "10 minutes",
  });
}

export async function verifyStoreEmailOTP(req, res) {
  const { otp } = req.body || {};
  if (!otp) return sendError(res, 400, "Validation", "OTP required");

  const store = await Store.findById(req.params.id).select(
    "+emailVerificationOTP +emailVerificationExpiry +emailVerificationAttempts"
  );
  if (!store) return sendError(res, 404, "Not found", "Store not found");

  if (
    !store.emailVerificationExpiry ||
    new Date() > store.emailVerificationExpiry
  ) {
    return sendError(res, 400, "Expired", "OTP expired");
  }
  if (
    !store.emailVerificationOTP ||
    !constantTimeCompare(String(otp), store.emailVerificationOTP)
  ) {
    store.emailVerificationAttempts = (store.emailVerificationAttempts || 0) + 1;
    await store.save();
    return sendError(res, 400, "Invalid OTP", "Invalid OTP");
  }

  store.isVerified = true;
  store.emailVerificationOTP = undefined;
  store.emailVerificationExpiry = undefined;
  store.emailVerificationAttempts = 0;
  await store.save();

  return sendSuccess(res, 200, {
    store: store.toJSON(),
    message: "Store email verified",
  });
}

export async function updateStoreCredentials(req, res) {
  if (!assertAdmin(req, res)) return;
  const { email, password } = req.body || {};
  if (!email && !password) {
    return sendError(res, 400, "Validation", "Provide email or password");
  }

  const store = await Store.findById(req.params.id);
  if (!store) return sendError(res, 404, "Not found", "Store not found");

  if (email) {
    const dup = await Store.findOne({
      email: String(email).toLowerCase(),
      _id: { $ne: store._id },
    });
    if (dup) return sendError(res, 409, "Conflict", "Email already in use");
    store.email = String(email).toLowerCase();
    store.isVerified = false;
  }
  if (password) {
    if (String(password).length < 8) {
      return sendError(res, 400, "Validation", "Password min 8 chars");
    }
    store.password = password;
  }
  if (email || password) {
    store.credentialsVersion = (store.credentialsVersion || 0) + 1;
    revokeAllSessions(store);
  }
  await store.save();

  logger.info("admin updated store credentials", {
    adminId: req.userId,
    storeId: store._id,
  });

  return sendSuccess(res, 200, {
    store: store.toJSON(),
    message: "Credentials updated",
  });
}

export async function updateStoreRazorpay(req, res) {
  if (!assertAdmin(req, res)) return;
  const allowed = [
    "linkedAccountId",
    "commissionPercent",
    "beneficiaryName",
    "contactName",
    "contactEmail",
    "contactPhone",
    "bankAccountNumber",
    "ifscCode",
    "legalBusinessName",
    "businessType",
    "profileCategory",
    "profileSubcategory",
    "address",
    "pan",
    "gst",
    "referenceId",
    "onboardingStatus",
  ];
  const patch = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) patch[`razorpay.${key}`] = req.body[key];
  }
  if (Object.keys(patch).length === 0) {
    return sendError(res, 400, "Validation", "No razorpay fields provided");
  }
  const store = await Store.findByIdAndUpdate(
    req.params.id,
    { $set: patch },
    { new: true, runValidators: true }
  );
  if (!store) return sendError(res, 404, "Not found", "Store not found");
  logger.info("admin updated store razorpay", {
    adminId: req.userId,
    storeId: store._id,
  });
  return sendSuccess(res, 200, {
    store: store.toJSON(),
    message: "Razorpay settings updated",
  });
}

export async function onboardStoreLinkedAccount(req, res) {
  if (!assertAdmin(req, res)) return;
  const store = await Store.findById(req.params.id).select(
    "+razorpay.bankAccountNumber +razorpay.pan +razorpay.gst"
  );
  if (!store) return sendError(res, 404, "Not found", "Store not found");
  if (store.razorpay?.linkedAccountId) {
    return sendError(
      res,
      409,
      "Conflict",
      "Store already has a Razorpay linked account; use sync instead"
    );
  }

  const created = await createLinkedAccount(store);
  if (!created.ok) {
    return sendError(
      res,
      created.status >= 500 ? 502 : 400,
      "Razorpay error",
      created.message
    );
  }

  store.razorpay = store.razorpay || {};
  store.razorpay.linkedAccountId = created.account.id;
  store.razorpay.onboardingStatus = mapRazorpayAccountStatus(
    created.account.status
  );
  store.razorpay.onboardingMeta = {
    lastSyncedAt: new Date(),
    rawStatus: created.account.status,
  };

  // Best-effort: configure Route product so payouts can settle
  if (store.razorpay.bankAccountNumber && store.razorpay.ifscCode) {
    const product = await requestRouteProduct(created.account.id, {
      bankAccountNumber: store.razorpay.bankAccountNumber,
      ifscCode: store.razorpay.ifscCode,
      beneficiaryName: store.razorpay.beneficiaryName || store.name,
    });
    if (!product.ok) {
      logger.warn("Route product request failed; account created without payout config", {
        storeId: String(store._id),
        message: product.message,
      });
    }
  }

  await store.save();
  logger.info("admin onboarded store to Razorpay Route", {
    adminId: req.userId,
    storeId: String(store._id),
    linkedAccountId: created.account.id,
  });

  return sendSuccess(res, 201, {
    store: store.toJSON(),
    linkedAccountId: created.account.id,
    rawStatus: created.account.status,
    message: "Razorpay linked account created",
  });
}

export async function syncStoreLinkedAccount(req, res) {
  if (!assertAdmin(req, res)) return;
  const store = await Store.findById(req.params.id);
  if (!store?.razorpay?.linkedAccountId) {
    return sendError(res, 404, "Not found", "Store has no linked account");
  }
  const fetched = await fetchLinkedAccount(store.razorpay.linkedAccountId);
  if (!fetched.ok) {
    return sendError(res, 502, "Razorpay error", fetched.message);
  }
  store.razorpay.onboardingStatus = mapRazorpayAccountStatus(
    fetched.body.status
  );
  store.razorpay.onboardingMeta = {
    lastSyncedAt: new Date(),
    rawStatus: fetched.body.status,
  };
  await store.save();
  return sendSuccess(res, 200, {
    store: store.toJSON(),
    rawStatus: fetched.body.status,
  });
}

export async function updateStoreDetails(req, res) {
  const allowed = ["name", "phone", "address", "location", "owner", "cuisineTypes", "upiId"];
  const update = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) update[key] = req.body[key];
  }
  const store = await Store.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!store) return sendError(res, 404, "Not found", "Store not found");
  return sendSuccess(res, 200, {
    store: store.toJSON(),
    message: "Store updated",
  });
}
