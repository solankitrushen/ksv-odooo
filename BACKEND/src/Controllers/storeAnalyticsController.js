import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  buildStoreDashboard,
  listFailedOrders,
  reviewFailedOrder,
} from "../Services/storeAnalyticsService.js";

export async function getStoreDashboard(req, res) {
  const storeId = req.userId;
  const result = await buildStoreDashboard(storeId, req.validatedQuery || {});
  if (!result.ok) {
    return sendError(res, 400, "Validation failed", result.message);
  }
  if (result.cacheHit) res.set("x-cache", "hit");
  return sendSuccess(res, 200, { dashboard: result.dashboard });
}

export async function getFailedOrders(req, res) {
  const storeId = req.userId;
  const result = await listFailedOrders(storeId, req.validatedQuery || {});
  if (!result.ok) {
    return sendError(res, 400, "Validation failed", result.message);
  }
  return sendSuccess(res, 200, {
    failedOrders: result.failedOrders,
    summary: result.summary,
    pagination: result.pagination,
    period: result.period,
  });
}

export async function postFailureReview(req, res) {
  const storeId = req.userId;
  const { id } = req.params;
  const notes = req.validated?.notes || "";
  const result = await reviewFailedOrder(storeId, id, storeId, notes);
  if (!result.ok) {
    return sendError(res, 404, "Not found", result.message);
  }
  return sendSuccess(res, 200, result);
}
