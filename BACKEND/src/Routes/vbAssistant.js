import { Router } from "express";
import rateLimit from "express-rate-limit";
import { VB_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import { chat } from "../Controllers/assistantController.js";

const STAFF = [VB_ROLES.ADMIN, VB_ROLES.OFFICER, VB_ROLES.MANAGER];

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
router.use(authMiddleware, tenantContext, roleMiddleware(STAFF));
router.post("/chat", limiter, asyncHandler(chat));

export default router;
