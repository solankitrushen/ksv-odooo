import User from "../Schema/User.js";
import Store from "../Schema/Store.js";
import Admin from "../Schema/Admin.js";
import {
  generateTokens,
  attachTokensResponse,
  clearAuthCookies,
  setAuthCookies,
  verifyToken,
  getAuthScope,
  readRefreshToken,
} from "../Auth/jwtUtils.js";
import { signAuthFlag, authFlagTtlSec } from "../Auth/authFlag.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { logger } from "../Utils/logger.js";
import { ROLES } from "../../config/constants.js";
import { blockDisposableEmail } from "../Utils/disposableEmail.js";

async function findAccountByRole(role, userId) {
  if (role === ROLES.USER) return User.findById(userId);
  if (role === ROLES.STORE) return Store.findById(userId);
  if (role === ROLES.ADMIN) return Admin.findById(userId);
  return null;
}

export async function storeRegister(req, res) {
  try {
    const { name, phone, email, password, address, upiId, location } =
      req.validated;
    const blocked = blockDisposableEmail(res, email, "store-register");
    if (blocked) return blocked;

    const dup = await Store.findOne({
      $or: [{ phone }, { email: email.toLowerCase() }],
    });
    if (dup) {
      return sendError(res, 409, "Conflict", "Store phone or email already registered");
    }

    const store = await Store.create({
      name,
      phone,
      email,
      password,
      address,
      location,
      upiId,
      bankDetails: upiId ? { upiId } : undefined,
    });

    const tokens = generateTokens(
      store._id,
      ROLES.STORE,
      store.email,
      null,
      store.credentialsVersion
    );
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, null, getAuthScope(req));
    return res.status(201).json({
      success: true,
      data: {
        message: "Store registered",
        user: store.toJSON(),
        tokens,
      },
    });
  } catch (err) {
    logger.error("storeRegister failed", { error: err.message });
    throw err;
  }
}

export async function storeLogin(req, res) {
  try {
    const { email, password } = req.validated;
    const store = await Store.findOne({
      email: email.toLowerCase(),
      isActive: true,
    }).select("+password");
    if (!store || !(await store.comparePassword(password))) {
      return sendError(res, 401, "Invalid credentials", "Email or password wrong");
    }

    if (!store.isVerified) {
      return sendError(
        res,
        403,
        "Verification pending",
        "Store awaiting admin approval"
      );
    }

    store.lastLogin = new Date();
    await store.save();

    const tokens = generateTokens(
      store._id,
      ROLES.STORE,
      store.email,
      null,
      store.credentialsVersion
    );
    return attachTokensResponse(res, store, tokens, 200, getAuthScope(req));
  } catch (err) {
    logger.error("storeLogin failed", { error: err.message });
    throw err;
  }
}

export async function adminLogin(req, res) {
  try {
    const { email, password } = req.validated;
    const blocked = blockDisposableEmail(res, email, "admin-login");
    if (blocked) return blocked;
    const admin = await Admin.findOne({
      email: email.toLowerCase(),
      isActive: true,
    }).select("+password");
    if (!admin || !(await admin.comparePassword(password))) {
      return sendError(res, 401, "Invalid credentials", "Email or password wrong");
    }

    admin.lastLogin = new Date();
    admin.loginHistory.push({
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    if (admin.loginHistory.length > 50) {
      admin.loginHistory = admin.loginHistory.slice(-50);
    }
    await admin.save();

    const tokens = generateTokens(admin._id, ROLES.ADMIN, admin.email);
    return attachTokensResponse(res, admin, tokens, 200, getAuthScope(req));
  } catch (err) {
    logger.error("adminLogin failed", { error: err.message });
    throw err;
  }
}

export function logout(req, res) {
  clearAuthCookies(res, getAuthScope(req));
  logger.info("Logout", { userId: req.userId, role: req.role });
  return sendSuccess(res, 200, { message: "Logged out successfully" });
}

export async function refreshTokens(req, res) {
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    return sendError(res, 401, "Unauthorized", "Refresh token required");
  }
  let decoded;
  try {
    decoded = verifyToken(refreshToken);
  } catch {
    return sendError(res, 401, "Unauthorized", "Invalid refresh token");
  }
  const account = await findAccountByRole(decoded.role, decoded.userId);
  if (!account || account.isActive === false) {
    return sendError(res, 401, "Unauthorized", "Account invalid");
  }
  if (decoded.role === ROLES.STORE) {
    const tokenCv = Number.isFinite(decoded.cv) ? decoded.cv : 0;
    const dbCv = Number.isFinite(account.credentialsVersion)
      ? account.credentialsVersion
      : 0;
    if (tokenCv !== dbCv) {
      return sendError(
        res,
        401,
        "Unauthorized",
        "Credentials changed; please log in again"
      );
    }
  }
  const tokens = generateTokens(
    account._id,
    decoded.role,
    account.email,
    null,
    account.credentialsVersion
  );
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken, null, getAuthScope(req));
  const authFlag = signAuthFlag({
    sub: account._id,
    role: decoded.role,
    scope: getAuthScope(req),
  });
  return sendSuccess(res, 200, {
    tokens,
    authFlag,
    authFlagMaxAgeSec: authFlagTtlSec(),
  });
}

export async function getMe(req, res) {
  try {
    const account = await findAccountByRole(req.role, req.userId);
    if (!account) {
      return sendError(res, 404, "Not found", "Account not found");
    }
    return sendSuccess(res, 200, {
      user: account.toJSON ? account.toJSON() : account,
      role: req.role,
    });
  } catch (err) {
    logger.error("getMe failed", { error: err.message });
    throw err;
  }
}
