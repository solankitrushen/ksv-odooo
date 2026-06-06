import { Router } from "express";
import { VB_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import { getActivity } from "../Controllers/activityController.js";

const STAFF = [VB_ROLES.ADMIN, VB_ROLES.OFFICER, VB_ROLES.MANAGER];

const router = Router();
router.use(authMiddleware, tenantContext, roleMiddleware(STAFF));
router.get("/", asyncHandler(getActivity));

export default router;
