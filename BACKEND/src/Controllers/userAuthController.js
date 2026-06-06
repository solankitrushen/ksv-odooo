import User from "../Schema/User.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { logger } from "../Utils/logger.js";
import { constantTimeCompare } from "../Utils/crypto.js";
import {
  generateOTP,
  sendOTPEmail,
  otpExpiryMs,
  lockoutMs,
} from "../Utils/otpManager.js";
import {
  issueUserAuth,
  revokeSession,
  revokeAllSessions,
  isSessionActive,
} from "../Utils/sessionManager.js";
import { clearAuthCookies, getAuthScope, readSessionId } from "../Auth/jwtUtils.js";
import { createOAuthState, consumeOAuthState } from "../Utils/oauthState.js";
import { ROLES } from "../../config/constants.js";
import { blockDisposableEmail, isDisposableEmail } from "../Utils/disposableEmail.js";

const GENERIC_AUTH_ERROR = "Invalid email or password";

function isLocked(until) {
  return until && new Date() < new Date(until);
}

function minutesLeft(until) {
  return Math.ceil((new Date(until) - new Date()) / 60000);
}

async function findByEmailOrPhone(email, phone) {
  if (email) return User.findOne({ email: email.toLowerCase() });
  if (phone) return User.findOne({ phone });
  return null;
}

function pendingRegisterResponse(res, user) {
  return res.status(201).json({
    success: true,
    data: {
      message: "Registration successful. Check your email for OTP.",
      userId: user._id,
      pendingVerification: true,
      otpSent: true,
      verifyUrl: "/api/v1/auth/verify-email",
      resendUrl: "/api/v1/auth/resend-otp",
      expiresIn: "10 minutes",
    },
  });
}

export async function userRegister(req, res) {
  const { name, email, phone, password, address } = req.validated;
  const emailNorm = email?.toLowerCase();

  if (emailNorm) {
    const blocked = blockDisposableEmail(res, emailNorm, "user-register");
    if (blocked) return blocked;

    const existing = await User.findOne({
      $or: [
        { email: emailNorm },
        ...(phone ? [{ phone }] : []),
      ],
    });

    if (existing) {
      if (existing.email && existing.email !== emailNorm) {
        return sendError(
          res,
          409,
          "Conflict",
          "Phone already registered with different email"
        );
      }
      if (existing.isVerified) {
        return sendError(res, 409, "Conflict", "Email already registered");
      }
      if (!existing.isVerified && existing.primaryIdentifier === "email") {
        const otp = generateOTP();
        existing.verificationToken = otp;
        existing.verificationExpiry = new Date(Date.now() + otpExpiryMs());
        await existing.save();
        await sendOTPEmail(existing.email, otp, existing.name);
      }
      return pendingRegisterResponse(res, existing);
    }

    const otp = generateOTP();
    let user;
    try {
      user = await User.create({
      name,
      email: emailNorm,
      phone: phone || undefined,
      password,
      primaryIdentifier: "email",
      isVerified: false,
      verificationToken: otp,
      verificationExpiry: new Date(Date.now() + otpExpiryMs()),
      address,
    });
    } catch (err) {
      if (err.code === 11000) {
        const dup = await User.findOne({ email: emailNorm });
        if (dup) return pendingRegisterResponse(res, dup);
      }
      throw err;
    }

    await sendOTPEmail(emailNorm, otp, name);
    return pendingRegisterResponse(res, user);
  }

  if (phone) {
    const exists = await User.findOne({ phone });
    if (exists) {
      return sendError(res, 409, "Conflict", "Phone already registered");
    }

    const user = await User.create({
      name,
      phone,
      password,
      primaryIdentifier: "phone",
      isVerified: true,
      address,
    });

    return await issueUserAuth(res, user, req, 201);
  }

  return sendError(res, 400, "Validation", "Provide email or phone");
}

export async function verifyEmail(req, res) {
  const { userId, otp } = req.validated;
  const user = await User.findById(userId).select(
    "+verificationToken +verificationExpiry"
  );

  if (!user) return sendError(res, 404, "Not found", "User not found");
  if (user.isVerified) {
    return sendError(res, 400, "Already verified", "Email already verified");
  }
  if (isLocked(user.verificationLockedUntil)) {
    return sendError(
      res,
      429,
      "Locked",
      `Try again in ${minutesLeft(user.verificationLockedUntil)} minutes`
    );
  }
  if (!user.verificationExpiry || new Date() > user.verificationExpiry) {
    return sendError(res, 400, "Expired", "OTP expired. Request a new one.");
  }

  if (!constantTimeCompare(String(otp), user.verificationToken)) {
    user.verificationAttempts += 1;
    if (user.verificationAttempts >= 5) {
      user.verificationLockedUntil = new Date(Date.now() + lockoutMs());
      await user.save();
      return sendError(res, 429, "Locked", "Too many failed attempts. Locked 15 minutes.");
    }
    await user.save();
    return res.status(400).json({
      success: false,
      error: "Invalid OTP",
      message: "Invalid OTP",
      data: { attemptsRemaining: 5 - user.verificationAttempts },
    });
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationExpiry = undefined;
  user.verificationAttempts = 0;
  user.verificationLockedUntil = undefined;
  await user.save();

  return sendSuccess(res, 200, {
    message: "Email verified. You can login now.",
    nextStep: "/api/v1/auth/user/login",
  });
}

export async function resendOTP(req, res) {
  const { userId } = req.validated;
  const user = await User.findById(userId).select("+verificationToken");

  if (!user) return sendError(res, 404, "Not found", "User not found");
  if (user.isVerified) {
    return sendError(res, 400, "Verified", "Email already verified");
  }

  const windowMs = parseInt(process.env.OTP_RESEND_WINDOW_MS || "3600000", 10);
  const limit = parseInt(process.env.OTP_RESEND_LIMIT || "3", 10);
  const now = Date.now();

  if (!user.resendWindowStart || now - user.resendWindowStart > windowMs) {
    user.resendWindowStart = new Date(now);
    user.resendAttempts = 0;
  }

  if (user.resendAttempts >= limit) {
    return sendError(res, 429, "Rate limit", "Too many resend attempts. Try in 1 hour.");
  }

  const otp = generateOTP();
  user.verificationToken = otp;
  user.verificationExpiry = new Date(Date.now() + otpExpiryMs());
  user.verificationAttempts = 0;
  user.verificationLockedUntil = undefined;
  user.resendAttempts += 1;
  await user.save();

  await sendOTPEmail(user.email, otp, user.name);

  return sendSuccess(res, 200, {
    message: "New OTP sent",
    expiresIn: "10 minutes",
  });
}

export async function userLogin(req, res) {
  const { email, phone, password } = req.validated;

  const user = await (
    email
      ? User.findOne({ email: email.toLowerCase(), isActive: true })
      : User.findOne({ phone, isActive: true })
  ).select("+password");

  if (!user) {
    logger.warn("Login fail — unknown identifier");
    return sendError(
      res,
      404,
      "USER_NOT_FOUND",
      email
        ? "No account found with this email"
        : "No account found with this number"
    );
  }

  if (user.primaryIdentifier === "email" && !user.isVerified) {
    return sendError(
      res,
      403,
      "Not verified",
      "Email not verified. Verify email to login."
    );
  }

  if (isLocked(user.accountLockedUntil)) {
    return sendError(
      res,
      429,
      "Locked",
      `Account locked. Try in ${minutesLeft(user.accountLockedUntil)} minutes.`
    );
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    user.loginHistory.push({
      timestamp: new Date(),
      method: email ? "email" : "phone",
      ip: req.ip,
      userAgent: req.get("user-agent"),
      success: false,
      failureReason: "wrong_password",
    });

    if (user.failedLoginAttempts >= 5) {
      user.accountLockedUntil = new Date(Date.now() + lockoutMs());
      user.failedLoginAttempts = 0;
      await user.save();
      return sendError(res, 429, "Locked", "Too many failed attempts. Locked 15 minutes.");
    }

    await user.save();
    return sendError(
      res,
      401,
      "INVALID_PASSWORD",
      "Incorrect password. Please try again."
    );
  }

  user.failedLoginAttempts = 0;
  user.accountLockedUntil = undefined;
  user.lastLogin = new Date();
  user.loginHistory.push({
    timestamp: new Date(),
    method: email ? "email" : "phone",
    ip: req.ip,
    userAgent: req.get("user-agent"),
    success: true,
  });
  await user.save();

  return await issueUserAuth(res, user, req);
}

export async function loginWithOTP(req, res) {
  const { email } = req.validated;

  const blocked = blockDisposableEmail(res, email, "login-otp");
  if (blocked) return blocked;

  const user = await User.findOne({
    email: email.toLowerCase(),
    isVerified: true,
    isActive: true,
  }).select("+loginOTP");

  if (!user) {
    return sendError(res, 400, "Invalid", "Email not found or not verified");
  }

  const otp = generateOTP();
  user.loginOTP = otp;
  user.loginOTPExpiry = new Date(Date.now() + 5 * 60 * 1000);
  user.loginOTPAttempts = 0;
  await user.save();

  await sendOTPEmail(email, otp, user.name, "login");

  return sendSuccess(res, 200, {
    message: "Check your email for OTP",
    verifyUrl: "/api/v1/auth/user/verify-login-otp",
    expiresIn: "5 minutes",
  });
}

export async function verifyLoginOTP(req, res) {
  const { email, otp } = req.validated;
  const user = await User.findOne({
    email: email.toLowerCase(),
    isActive: true,
  }).select("+loginOTP +loginOTPExpiry");

  if (!user) return sendError(res, 401, "Unauthorized", GENERIC_AUTH_ERROR);

  if (!user.loginOTPExpiry || new Date() > user.loginOTPExpiry) {
    return sendError(res, 400, "Expired", "OTP expired");
  }

  if (!constantTimeCompare(String(otp), user.loginOTP)) {
    user.loginOTPAttempts = (user.loginOTPAttempts || 0) + 1;
    if (user.loginOTPAttempts >= 3) {
      user.loginOTP = undefined;
      user.loginOTPExpiry = undefined;
      await user.save();
      return sendError(res, 429, "Locked", "Too many failed OTP attempts");
    }
    await user.save();
    return sendError(res, 400, "Invalid OTP", "Invalid OTP");
  }

  user.loginOTP = undefined;
  user.loginOTPExpiry = undefined;
  user.loginOTPAttempts = 0;
  user.lastLogin = new Date();
  user.loginHistory.push({
    timestamp: new Date(),
    method: "otp",
    ip: req.ip,
    userAgent: req.get("user-agent"),
    success: true,
  });
  await user.save();

  return await issueUserAuth(res, user, req);
}

export function oauthGoogleStart(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return sendError(res, 503, "Unavailable", "Google OAuth not configured");
  }

  const state = createOAuthState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

export async function oauthCallback(req, res) {
  const { code, state } = req.query;
  if (!code || !consumeOAuthState(state)) {
    return sendError(res, 400, "Invalid OAuth", "Invalid state or code");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    return sendError(res, 503, "Unavailable", "Google OAuth not configured");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error || "token exchange failed");
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const profile = await profileRes.json();

    if (!profile.email) {
      return sendError(res, 400, "OAuth", "Provider did not return email");
    }

    const email = profile.email.toLowerCase();

    if (isDisposableEmail(email)) {
      return sendError(
        res,
        400,
        "Invalid email",
        "Disposable email addresses are not allowed"
      );
    }

    let user = await User.findOne({
      "oauthProviders.provider": "google",
      "oauthProviders.providerId": profile.id,
    });

    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        user.oauthProviders.push({
          provider: "google",
          providerId: profile.id,
          email,
          displayName: profile.name,
          linkedAt: new Date(),
        });
        if (!user.isVerified) user.isVerified = true;
      } else {
        user = await User.create({
          name: profile.name || "User",
          email,
          primaryIdentifier: "email",
          isVerified: true,
          oauthProviders: [
            {
              provider: "google",
              providerId: profile.id,
              email,
              displayName: profile.name,
              linkedAt: new Date(),
            },
          ],
        });
      }
    }

    user.lastLogin = new Date();
    user.loginHistory.push({
      timestamp: new Date(),
      method: "oauth-google",
      ip: req.ip,
      userAgent: req.get("user-agent"),
      success: true,
    });
    await user.save();

    if (req.headers.accept?.includes("application/json")) {
      return await issueUserAuth(res, user, req);
    }

    const clientUrl = process.env.CLIENT_URL_PROD || process.env.CLIENT_URL_DEV || "/";
    return res.redirect(`${clientUrl}/auth/success`);
  } catch (err) {
    logger.error("OAuth callback failed", { error: err.message });
    const clientUrl = process.env.CLIENT_URL_PROD || process.env.CLIENT_URL_DEV || "/";
    return res.redirect(`${clientUrl}/auth/error?reason=oauth_failed`);
  }
}

export async function listSessions(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return sendError(res, 404, "Not found", "User not found");

  const sessions = (user.sessions || [])
    .filter((s) => !s.revokedAt)
    .map((s) => ({
      tokenId: s.tokenId,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      deviceName: s.deviceName,
      ipAddress: s.ipAddress,
      current: s.tokenId === readSessionId(req),
    }));

  return sendSuccess(res, 200, { sessions });
}

export async function revokeSessionHandler(req, res) {
  const { sessionId } = req.validated;
  const user = await User.findById(req.userId);
  if (!user) return sendError(res, 404, "Not found", "User not found");

  revokeSession(user, sessionId);
  await user.save();

  if (sessionId === readSessionId(req)) {
    clearAuthCookies(res, getAuthScope(req));
  }

  return sendSuccess(res, 200, { message: "Session revoked" });
}

export async function revokeAllSessionsHandler(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return sendError(res, 404, "Not found", "User not found");

  revokeAllSessions(user);
  await user.save();
  clearAuthCookies(res, getAuthScope(req));

  return sendSuccess(res, 200, { message: "All sessions revoked" });
}

