import crypto from "crypto";
import { VB_ROLES, VENDOR_STATUS } from "../../config/constants.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { sendVendorEmail } from "../Services/vbMailer.js";
import { logActivity } from "../Services/activityService.js";
import { logger } from "../Utils/logger.js";
import Tenant from "../Schema/Tenant.js";
import Vendor from "../Schema/Vendor.js";
import VbUser from "../Schema/VbUser.js";
import VbMembership from "../Schema/VbMembership.js";

/** Generate a readable, complexity-meeting temporary password (>= 8 chars). */
function generateTempPassword() {
  const rand = crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `Vb${rand}1!`;
}

function portalUrl() {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/auth/login`;
}

export async function createVendor(req, res) {
  const { tenantId, userId } = req;
  const data = req.validated;

  if (await Vendor.findOne({ tenantId, email: data.email })) {
    return sendError(res, 409, "Conflict", "Vendor email already exists in this tenant");
  }

  // Provision (or reuse) a VbUser so the vendor can log in to the portal directly.
  let user = await VbUser.findOne({ email: data.email.toLowerCase() });
  let tempPassword = null;
  let accountExisted = false;
  if (user) {
    accountExisted = true; // never silently reset an existing account's password
  } else {
    tempPassword = generateTempPassword();
    user = await VbUser.create({
      name: data.contactPerson || data.name,
      email: data.email,
      password: tempPassword,
      isVerified: true,
      isActive: true,
    });
  }

  const vendor = await Vendor.create({
    ...data,
    tenantId,
    status: VENDOR_STATUS.ACTIVE,
    userId: user._id,
    createdBy: userId,
  });

  // Active vendor membership scoped to this tenant + vendor.
  await VbMembership.findOneAndUpdate(
    { userId: user._id, tenantId },
    {
      $set: {
        userId: user._id,
        tenantId,
        roles: [VB_ROLES.VENDOR],
        vendorId: vendor._id,
        status: "active",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const tenant = await Tenant.findById(tenantId).lean();
  const url = portalUrl();

  // Email the vendor their portal link (+ temp password for brand-new accounts).
  const mail = await sendVendorEmail({
    to: data.email,
    subject: `Your ${tenant?.name || "VendorBridge"} vendor portal access`,
    text:
      `You've been added as a vendor on ${tenant?.name || "VendorBridge"}.\n\n` +
      `Portal: ${url}\n` +
      `Email: ${data.email}\n` +
      (tempPassword
        ? `Temporary password: ${tempPassword}\n\nPlease log in and change your password.`
        : `Use your existing account password to log in.`),
  }).catch((err) => {
    logger.warn("vendor credential email failed", { error: err.message });
    return { sent: false };
  });

  logActivity({
    tenantId,
    type: "vendor",
    action: "created",
    message: `Vendor "${vendor.name}" added and portal access provisioned`,
    severity: "success",
    actorId: userId,
    actorRole: "admin",
    vendorId: vendor._id,
  });

  return res.status(201).json({
    success: true,
    data: {
      vendor: vendor.toJSON(),
      emailSent: mail.sent,
      accountExisted,
      // credentials returned so the admin can copy/share them from the UI.
      // tempPassword is present only for brand-new accounts.
      credentials: {
        email: data.email,
        portalUrl: url,
        ...(tempPassword ? { tempPassword } : {}),
      },
    },
  });
}

export async function listVendors(req, res) {
  const { tenantId } = req;
  const { q, category, status, page = 1, pageSize = 20 } = req.validatedQuery || {};
  const filter = { tenantId };
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (q) filter.name = { $regex: q, $options: "i" };

  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    Vendor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Vendor.countDocuments(filter),
  ]);
  return sendSuccess(res, 200, { items, total, page, pageSize });
}

export async function getVendor(req, res) {
  const vendor = await Vendor.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
  if (!vendor) return sendError(res, 404, "Not found", "Vendor not found");
  return sendSuccess(res, 200, { vendor });
}

export async function updateVendor(req, res) {
  const vendor = await Vendor.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.tenantId },
    { $set: req.validated },
    { new: true, runValidators: true }
  );
  if (!vendor) return sendError(res, 404, "Not found", "Vendor not found");
  return sendSuccess(res, 200, { vendor: vendor.toJSON() });
}

export async function deactivateVendor(req, res) {
  const { tenantId, userId } = req;
  const vendor = await Vendor.findOneAndUpdate(
    { _id: req.params.id, tenantId },
    { $set: { status: VENDOR_STATUS.INACTIVE } },
    { new: true }
  );
  if (!vendor) return sendError(res, 404, "Not found", "Vendor not found");

  // block portal access for this tenant (keep the user account itself intact)
  if (vendor.userId) {
    await VbMembership.updateOne(
      { userId: vendor.userId, tenantId },
      { $set: { status: "inactive" } }
    );
  }
  logActivity({
    tenantId,
    type: "vendor",
    action: "deactivated",
    message: `Vendor "${vendor.name}" deactivated`,
    severity: "warn",
    actorId: userId,
    actorRole: "admin",
    vendorId: vendor._id,
  });
  return sendSuccess(res, 200, { vendor: vendor.toJSON() });
}

export async function activateVendor(req, res) {
  const { tenantId, userId } = req;
  const vendor = await Vendor.findOneAndUpdate(
    { _id: req.params.id, tenantId },
    { $set: { status: VENDOR_STATUS.ACTIVE } },
    { new: true }
  );
  if (!vendor) return sendError(res, 404, "Not found", "Vendor not found");

  if (vendor.userId) {
    await Promise.all([
      VbUser.updateOne({ _id: vendor.userId }, { $set: { isActive: true } }),
      VbMembership.updateOne(
        { userId: vendor.userId, tenantId },
        { $set: { status: "active" } }
      ),
    ]);
  }
  logActivity({
    tenantId,
    type: "vendor",
    action: "activated",
    message: `Vendor "${vendor.name}" activated`,
    severity: "success",
    actorId: userId,
    actorRole: "admin",
    vendorId: vendor._id,
  });
  return sendSuccess(res, 200, { vendor: vendor.toJSON() });
}

/**
 * Resend portal access — regenerate a temporary password for the vendor's
 * login, email it, and return the new credentials so the admin can share them.
 * The vendor can then change it from their dashboard.
 */
export async function resetVendorCredentials(req, res) {
  const { tenantId, userId } = req;
  const vendor = await Vendor.findOne({ _id: req.params.id, tenantId });
  if (!vendor) return sendError(res, 404, "Not found", "Vendor not found");

  const tempPassword = generateTempPassword();
  let user = vendor.userId ? await VbUser.findById(vendor.userId).select("+password") : null;

  if (user) {
    user.password = tempPassword; // re-hashed by pre-save hook
    user.isActive = true;
    await user.save();
  } else {
    // legacy/invited vendor without a login yet — create one now
    user = await VbUser.create({
      name: vendor.contactPerson || vendor.name,
      email: vendor.email,
      password: tempPassword,
      isVerified: true,
      isActive: true,
    });
    vendor.userId = user._id;
    vendor.status = VENDOR_STATUS.ACTIVE;
    await vendor.save();
  }

  await VbMembership.findOneAndUpdate(
    { userId: user._id, tenantId },
    {
      $set: {
        userId: user._id,
        tenantId,
        roles: [VB_ROLES.VENDOR],
        vendorId: vendor._id,
        status: "active",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const tenant = await Tenant.findById(tenantId).lean();
  const url = portalUrl();
  const mail = await sendVendorEmail({
    to: vendor.email,
    subject: `Your ${tenant?.name || "VendorBridge"} portal password was reset`,
    text:
      `Your vendor portal password has been reset.\n\n` +
      `Portal: ${url}\nEmail: ${vendor.email}\nTemporary password: ${tempPassword}\n\n` +
      `Please log in and change your password from your dashboard.`,
  }).catch((err) => {
    logger.warn("vendor reset email failed", { error: err.message });
    return { sent: false };
  });

  logActivity({
    tenantId,
    type: "vendor",
    action: "credentials_reset",
    message: `Portal credentials reset for "${vendor.name}"`,
    severity: "info",
    actorId: userId,
    actorRole: "admin",
    vendorId: vendor._id,
  });

  return sendSuccess(res, 200, {
    vendor: vendor.toJSON(),
    emailSent: mail.sent,
    credentials: { email: vendor.email, portalUrl: url, tempPassword },
  });
}
