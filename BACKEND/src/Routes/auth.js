import { Router } from "express";
import { validate } from "../Validators/authValidator.js";
import {
  userRegisterSchema,
  userLoginSchema,
  verifyEmailSchema,
  resendOTPSchema,
  loginOTPSchema,
  verifyLoginOTPSchema,
  revokeSessionSchema,
  storeRegisterSchema,
  storeLoginSchema,
  adminLoginSchema,
} from "../Validators/authValidator.js";
import {
  userRegister,
  verifyEmail,
  resendOTP,
  userLogin,
  loginWithOTP,
  verifyLoginOTP,
  oauthGoogleStart,
  oauthCallback,
  listSessions,
  revokeSessionHandler,
  revokeAllSessionsHandler,
} from "../Controllers/userAuthController.js";
import {
  storeRegister,
  storeLogin,
  adminLogin,
  logout,
  getMe,
  refreshTokens,
} from "../Controllers/authController.js";
import {
  makeChangePassword,
  makeForgotPassword,
  makeResetPassword,
} from "../Controllers/passwordController.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { ROLES } from "../../config/constants.js";
import { authRateLimiter } from "../Middleware/rateLimiter.js";
import { loginRateLimiter } from "../Middleware/loginRateLimiter.js";
import { asyncHandler } from "../Utils/asyncHandler.js";

const router = Router();

// Skip rate limit on read-only session check and token refresh.
// /me is polled by clients to verify session; /refresh fires on token expiry.
// Both are session-bound (require valid auth cookie), so abuse is bounded.
router.use((req, res, next) => {
  const safePath = req.path === "/me" || req.path === "/refresh" || req.path === "/csrf";
  if (safePath) return next();
  return authRateLimiter(req, res, next);
});

// User — register / verify
router.post(
  "/user/register",
  validate(userRegisterSchema),
  asyncHandler(userRegister)
);
router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  asyncHandler(verifyEmail)
);
router.post("/resend-otp", validate(resendOTPSchema), asyncHandler(resendOTP));

// User — login
router.post(
  "/user/login",
  loginRateLimiter,
  validate(userLoginSchema),
  asyncHandler(userLogin)
);
router.post(
  "/user/login-otp",
  loginRateLimiter,
  validate(loginOTPSchema),
  asyncHandler(loginWithOTP)
);
router.post(
  "/user/verify-login-otp",
  loginRateLimiter,
  validate(verifyLoginOTPSchema),
  asyncHandler(verifyLoginOTP)
);

// OAuth
router.get("/user/oauth/google", oauthGoogleStart);
router.get("/user/oauth/callback", asyncHandler(oauthCallback));

// User — sessions (protected)
router.get(
  "/user/sessions",
  authMiddleware,
  roleMiddleware([ROLES.USER]),
  asyncHandler(listSessions)
);
router.post(
  "/user/sessions/revoke",
  authMiddleware,
  roleMiddleware([ROLES.USER]),
  validate(revokeSessionSchema),
  asyncHandler(revokeSessionHandler)
);
router.post(
  "/user/sessions/revoke-all",
  authMiddleware,
  roleMiddleware([ROLES.USER]),
  asyncHandler(revokeAllSessionsHandler)
);

router.post(
  "/user/logout",
  authMiddleware,
  roleMiddleware([ROLES.USER]),
  logout
);

// User — password flows
router.post("/user/forgot-password", loginRateLimiter, asyncHandler(makeForgotPassword("user")));
router.post("/user/reset-password", loginRateLimiter, asyncHandler(makeResetPassword("user")));
router.post(
  "/user/change-password",
  authMiddleware,
  roleMiddleware([ROLES.USER]),
  asyncHandler(makeChangePassword("user"))
);

// Store
router.post(
  "/store/register",
  validate(storeRegisterSchema),
  asyncHandler(storeRegister)
);
router.post(
  "/store/login",
  validate(storeLoginSchema),
  asyncHandler(storeLogin)
);
router.post(
  "/store/logout",
  authMiddleware,
  roleMiddleware([ROLES.STORE]),
  logout
);

// Store — password flows
router.post("/store/forgot-password", asyncHandler(makeForgotPassword("store")));
router.post("/store/reset-password", asyncHandler(makeResetPassword("store")));
router.post(
  "/store/change-password",
  authMiddleware,
  roleMiddleware([ROLES.STORE]),
  asyncHandler(makeChangePassword("store"))
);

// Admin — password flows
router.post("/admin/forgot-password", asyncHandler(makeForgotPassword("admin")));
router.post("/admin/reset-password", asyncHandler(makeResetPassword("admin")));
router.post(
  "/admin/change-password",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  asyncHandler(makeChangePassword("admin"))
);

// Admin
router.post(
  "/admin/login",
  validate(adminLoginSchema),
  asyncHandler(adminLogin)
);
router.post(
  "/admin/logout",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  logout
);

router.get("/me", authMiddleware, asyncHandler(getMe));

// Public: lets SPAs obtain a CSRF cookie before their first state-changing
// request (the csrfProtection middleware seeds the cookie on this safe GET).
router.get("/csrf", (_req, res) => res.status(200).json({ success: true }));

router.post("/refresh", asyncHandler(refreshTokens));

export default router;
