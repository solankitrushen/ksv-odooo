import { Router } from "express";
import { VB_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import { listMyRfqs, getMyRfq } from "../Controllers/quotationController.js";
import { vendorDashboard } from "../Controllers/vbVendorAnalyticsController.js";

const VENDOR = [VB_ROLES.VENDOR];

const router = Router();
router.use(authMiddleware, tenantContext, roleMiddleware(VENDOR));

// Vendor RFQ inbox + detail (with own quotation status) — FR-3 / FR-4
router.get("/rfqs", asyncHandler(listMyRfqs));
router.get("/rfqs/:id", asyncHandler(getMyRfq));
router.get("/analytics", asyncHandler(vendorDashboard));

export default router;
