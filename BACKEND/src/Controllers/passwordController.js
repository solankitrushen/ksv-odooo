import Store from "../Schema/Store.js";
import Admin from "../Schema/Admin.js";
import User from "../Schema/User.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { logger } from "../Utils/logger.js";
import {
  generateOTP,
  sendOTPEmail,
  otpExpiryMs,
} from "../Utils/otpManager.js";
import { constantTimeCompare } from "../Utils/crypto.js";

function modelByRole(role) {
  if (role === "store") return Store;
  if (role === "admin") return Admin;
  if (role === "user") return User;
  return null;
}

async function findActiveAccount(role, email) {
  const Model = modelByRole(role);
  if (!Model) return null;
  return Model.findOne({ email: String(email).toLowerCase(), isActive: true });
}

export function makeForgotPassword(role) {
  return async function forgotPassword(req, res) {
    const { email } = req.body || {};
    if (!email) return sendError(res, 400, "Validation", "Email required");

    const account = await findActiveAccount(role, email);
    // Always return success to avoid email enumeration
    if (!account) {
      return sendSuccess(res, 200, {
        message: "If account exists, an OTP was sent",
      });
    }

    const otp = generateOTP();
    account.passwordResetOTP = otp;
    account.passwordResetExpiry = new Date(Date.now() + otpExpiryMs());
    account.passwordResetAttempts = 0;
    await account.save();

    await sendOTPEmail(account.email, otp, account.name || "User", "password-reset");
    logger.info("password reset OTP sent", { role, email: account.email });

    return sendSuccess(res, 200, {
      message: "If account exists, an OTP was sent",
      expiresIn: "10 minutes",
    });
  };
}

export function makeResetPassword(role) {
  return async function resetPassword(req, res) {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) {
      return sendError(res, 400, "Validation", "email, otp, newPassword required");
    }
    if (String(newPassword).length < 8) {
      return sendError(res, 400, "Validation", "Password min 8 chars");
    }

    const Model = modelByRole(role);
    if (!Model) return sendError(res, 400, "Invalid role", "Invalid role");
    const account = await Model.findOne({
      email: String(email).toLowerCase(),
      isActive: true,
    }).select("+passwordResetOTP +passwordResetExpiry +passwordResetAttempts");
    if (!account) return sendError(res, 400, "Invalid", "Invalid email or OTP");

    if (
      !account.passwordResetExpiry ||
      new Date() > account.passwordResetExpiry
    ) {
      return sendError(res, 400, "Expired", "OTP expired");
    }
    if (
      !account.passwordResetOTP ||
      !constantTimeCompare(String(otp), account.passwordResetOTP)
    ) {
      account.passwordResetAttempts = (account.passwordResetAttempts || 0) + 1;
      if (account.passwordResetAttempts >= 5) {
        account.passwordResetOTP = undefined;
        account.passwordResetExpiry = undefined;
        await account.save();
        return sendError(res, 429, "Locked", "Too many failed attempts");
      }
      await account.save();
      return sendError(res, 400, "Invalid OTP", "Invalid OTP");
    }

    account.password = newPassword;
    account.passwordResetOTP = undefined;
    account.passwordResetExpiry = undefined;
    account.passwordResetAttempts = 0;
    await account.save();

    return sendSuccess(res, 200, {
      message: "Password reset. Login with new password.",
    });
  };
}

export function makeChangePassword(role) {
  return async function changePassword(req, res) {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return sendError(res, 400, "Validation", "currentPassword and newPassword required");
    }
    if (String(newPassword).length < 8) {
      return sendError(res, 400, "Validation", "Password min 8 chars");
    }

    const Model = modelByRole(role);
    if (!Model) return sendError(res, 400, "Invalid role", "Invalid role");
    const account = await Model.findById(req.userId).select("+password");
    if (!account) return sendError(res, 404, "Not found", "Account not found");

    const ok = await account.comparePassword(currentPassword);
    if (!ok) return sendError(res, 401, "Unauthorized", "Current password incorrect");

    account.password = newPassword;
    await account.save();

    logger.info("password changed", { role, accountId: account._id });
    return sendSuccess(res, 200, { message: "Password updated" });
  };
}
