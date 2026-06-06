import {
  clearAuthCookies,
  generateTokens,
  getAuthScope,
  setAuthCookies,
} from "../Auth/jwtUtils.js";
import { signAuthFlag, authFlagTtlSec } from "../Auth/authFlag.js";
import {
  INVITE_STATUS,
  TENANT_STATUS,
  VB_ROLES,
  VENDOR_STATUS,
} from "../../config/constants.js";
import { consumeVendorInvite } from "../Services/vendorInviteService.js";
import { createSessionId, pushSession } from "../Utils/sessionManager.js";
import { logger } from "../Utils/logger.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import Tenant from "../Schema/Tenant.js";
import Vendor from "../Schema/Vendor.js";
import VbMembership from "../Schema/VbMembership.js";
import VbUser from "../Schema/VbUser.js";

async function issueVbAuth(res, req, user, membership, statusCode = 200) {
  const sessionId = createSessionId();
  const tokens = generateTokens(user._id, membership.roles[0], user.email, sessionId, 0, {
    realm: "vb",
    roles: membership.roles,
    tenantId: String(membership.tenantId),
  });
  pushSession(user, req, sessionId);
  user.lastLogin = new Date();
  await user.save();
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken, sessionId, getAuthScope(req));
  const scope = getAuthScope(req);
  const authFlag = signAuthFlag({
    sub: user._id,
    role: membership.roles[0],
    scope,
  });
  return res.status(statusCode).json({
    success: true,
    data: {
      message: "Authenticated",
      user: user.toJSON(),
      roles: membership.roles,
      tenantId: String(membership.tenantId),
      tokens,
      sessionId,
      authFlag,
      authFlagMaxAgeSec: authFlagTtlSec(),
    },
  });
}

async function tenantChoices(userId) {
  const memberships = await VbMembership.find({ userId, status: "active" }).lean();
  const tenants = await Tenant.find({
    _id: { $in: memberships.map((m) => m.tenantId) },
    status: TENANT_STATUS.ACTIVE,
  }).lean();
  const byId = new Map(tenants.map((t) => [String(t._id), t]));
  return memberships
    .filter((m) => byId.has(String(m.tenantId)))
    .map((m) => ({
      tenantId: String(m.tenantId),
      name: byId.get(String(m.tenantId)).name,
      slug: byId.get(String(m.tenantId)).slug,
      roles: m.roles,
      membership: m,
    }));
}

export async function registerTenant(req, res) {
  const { tenant, admin } = req.validated;

  if (await Tenant.findOne({ slug: tenant.slug })) {
    return sendError(res, 409, "Conflict", "Tenant slug already taken");
  }
  if (await VbUser.findOne({ email: admin.email })) {
    return sendError(res, 409, "Conflict", "Email already registered");
  }

  const tenantDoc = await Tenant.create({
    name: tenant.name,
    slug: tenant.slug,
    contactEmail: tenant.contactEmail,
  });

  let user;
  let membership;
  try {
    user = await VbUser.create({
      name: admin.name,
      email: admin.email,
      password: admin.password,
      isVerified: true,
    });
    membership = await VbMembership.create({
      userId: user._id,
      tenantId: tenantDoc._id,
      roles: [VB_ROLES.ADMIN],
    });
  } catch (err) {
    await Tenant.deleteOne({ _id: tenantDoc._id });
    if (user) await VbUser.deleteOne({ _id: user._id });
    throw err;
  }

  tenantDoc.createdBy = user._id;
  await tenantDoc.save();

  logger.info("VB tenant registered", { tenantId: tenantDoc._id });
  return issueVbAuth(res, req, user, membership, 201);
}

export async function vbLogin(req, res) {
  const { email, password, tenantId } = req.validated;
  const user = await VbUser.findOne({ email, isActive: true }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, 401, "Invalid credentials", "Email or password wrong");
  }

  const choices = await tenantChoices(user._id);
  if (choices.length === 0) {
    return sendError(res, 403, "No access", "Account has no active tenant membership");
  }

  let chosen;
  if (tenantId) {
    chosen = choices.find((c) => c.tenantId === tenantId);
    if (!chosen) {
      return sendError(res, 403, "No access", "No membership for that tenant");
    }
  } else if (choices.length === 1) {
    chosen = choices[0];
  } else {
    return sendSuccess(res, 200, {
      needsTenantSelection: true,
      tenants: choices.map(({ membership: _membership, ...c }) => c),
    });
  }

  return issueVbAuth(res, req, user, chosen.membership, 200);
}

export async function switchTenant(req, res) {
  const { tenantId } = req.validated;
  const membership = await VbMembership.findOne({
    userId: req.userId,
    tenantId,
    status: "active",
  });
  if (!membership) {
    return sendError(res, 403, "No access", "No membership for that tenant");
  }
  const tenant = await Tenant.findOne({ _id: tenantId, status: TENANT_STATUS.ACTIVE });
  if (!tenant) {
    return sendError(res, 403, "No access", "Tenant unavailable");
  }
  return issueVbAuth(res, req, req.vbUser, membership, 200);
}

export async function activateVendor(req, res) {
  const { name, password, token } = req.validated;
  const result = await consumeVendorInvite(token);
  if (!result.ok) {
    const msg = result.reason === "expired" ? "Invite expired" : "Invalid or used invite";
    return sendError(res, 400, "Invite invalid", msg);
  }
  const { invite } = result;

  let user = await VbUser.findOne({ email: invite.email });
  let reusedAccount = false;
  if (user) {
    reusedAccount = true;
  } else {
    user = await VbUser.create({
      name,
      email: invite.email,
      password,
      isVerified: true,
    });
  }

  const existing = await VbMembership.findOne({ userId: user._id, tenantId: invite.tenantId });
  const membership =
    existing ||
    (await VbMembership.create({
      userId: user._id,
      tenantId: invite.tenantId,
      roles: [VB_ROLES.VENDOR],
      vendorId: invite.vendorId,
    }));

  await Vendor.updateOne(
    { _id: invite.vendorId, tenantId: invite.tenantId },
    { $set: { status: VENDOR_STATUS.ACTIVE, userId: user._id } }
  );
  invite.status = INVITE_STATUS.ACCEPTED;
  invite.acceptedAt = new Date();
  await invite.save();

  logger.info("VB vendor activated", {
    tenantId: invite.tenantId,
    vendorId: invite.vendorId,
    reusedAccount,
  });

  if (reusedAccount) {
    return sendSuccess(res, 200, {
      message: "Membership added to existing account; please log in",
      reusedAccount: true,
      tenantId: String(invite.tenantId),
    });
  }
  return issueVbAuth(res, req, user, membership, 201);
}

export function vbLogout(req, res) {
  clearAuthCookies(res, getAuthScope(req));
  return sendSuccess(res, 200, { message: "Logged out" });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated;
  const user = await VbUser.findById(req.userId).select("+password");
  if (!user) return sendError(res, 404, "Not found", "Account not found");
  const ok = await user.comparePassword(currentPassword);
  if (!ok) return sendError(res, 400, "Invalid password", "Current password is incorrect");
  if (currentPassword === newPassword)
    return sendError(res, 400, "Invalid password", "New password must differ from the current one");
  user.password = newPassword; // re-hashed by pre-save hook
  if (typeof user.credentialsVersion === "number") user.credentialsVersion += 1;
  await user.save();
  return sendSuccess(res, 200, { message: "Password changed" });
}

export async function vbMe(req, res) {
  const user = await VbUser.findById(req.userId);
  if (!user) return sendError(res, 404, "Not found", "Account not found");
  const choices = await tenantChoices(user._id);
  return sendSuccess(res, 200, {
    user: user.toJSON(),
    activeTenantId: req.tenantId,
    roles: req.roles,
    tenants: choices.map(({ membership: _membership, ...c }) => c),
  });
}
