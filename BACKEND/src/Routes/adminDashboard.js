import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import {
  validateQuery,
  dashboardQuerySchema,
  salesReportQuerySchema,
} from "../Validators/adminDashboardValidator.js";
import {
  getAdminDashboard,
  getSalesReport,
  getPerStoreAnalytics,
} from "../Controllers/adminDashboardController.js";

const router = Router();

router.get(
  "/dashboard",
  validateQuery(dashboardQuerySchema),
  asyncHandler(getAdminDashboard)
);

router.get(
  "/dashboard/per-store",
  validateQuery(dashboardQuerySchema),
  asyncHandler(getPerStoreAnalytics)
);

router.get(
  "/reports/sales",
  validateQuery(salesReportQuerySchema),
  asyncHandler(getSalesReport)
);

export default router;
