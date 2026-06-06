import { Router } from "express";
import {
  activateVendor,
  registerTenant,
  switchTenant,
  vbLogin,
  vbLogout,
  vbMe,
  changePassword,
} from "../Controllers/vbAuthController.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { authRateLimiter } from "../Middleware/rateLimiter.js";
import { loginRateLimiter } from "../Middleware/loginRateLimiter.js";
import {
  registerTenantSchema,
  switchTenantSchema,
  vbLoginSchema,
  changePasswordSchema,
} from "../Validators/vbAuthValidator.js";
import { activateVendorSchema } from "../Validators/inviteValidator.js";
import { validate } from "../Validators/authValidator.js";

const router = Router();

router.post("/register-tenant", authRateLimiter, validate(registerTenantSchema), asyncHandler(registerTenant));
router.post("/login", loginRateLimiter, validate(vbLoginSchema), asyncHandler(vbLogin));
router.post("/vendor/activate", loginRateLimiter, validate(activateVendorSchema), asyncHandler(activateVendor));
router.post("/switch-tenant", authMiddleware, validate(switchTenantSchema), asyncHandler(switchTenant));
router.post("/logout", authMiddleware, vbLogout);
router.post("/change-password", authMiddleware, validate(changePasswordSchema), asyncHandler(changePassword));
router.get("/me", authMiddleware, asyncHandler(vbMe));

export default router;
