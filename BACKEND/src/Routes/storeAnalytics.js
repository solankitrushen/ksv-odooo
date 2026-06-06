import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import {
  validateQuery,
  validateBody,
  dashboardQuerySchema,
  failedOrdersQuerySchema,
  failureReviewSchema,
} from "../Validators/storeAnalyticsValidator.js";
import {
  getStoreDashboard,
  getFailedOrders,
  postFailureReview,
} from "../Controllers/storeAnalyticsController.js";

const router = Router();

router.get(
  "/dashboard",
  validateQuery(dashboardQuerySchema),
  asyncHandler(getStoreDashboard)
);

router.get(
  "/orders/failed",
  validateQuery(failedOrdersQuerySchema),
  asyncHandler(getFailedOrders)
);

router.patch(
  "/orders/:id/failure-review",
  validateBody(failureReviewSchema),
  asyncHandler(postFailureReview)
);

export default router;
