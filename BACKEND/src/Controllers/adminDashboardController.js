import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  buildAdminDashboard,
  buildSalesReport,
  buildPerStoreAnalytics,
} from "../Services/adminAnalyticsService.js";

export async function getAdminDashboard(req, res) {
  const result = await buildAdminDashboard(req.validatedQuery);
  if (!result.ok) {
    return sendError(res, 400, "Validation failed", result.message);
  }
  return sendSuccess(res, 200, { dashboard: result.dashboard });
}

export async function getSalesReport(req, res) {
  const result = await buildSalesReport(req.validatedQuery);
  if (!result.ok) {
    return sendError(res, 400, "Validation failed", result.message);
  }
  return sendSuccess(res, 200, { report: result.report });
}

export async function getPerStoreAnalytics(req, res) {
  const result = await buildPerStoreAnalytics(req.validatedQuery);
  if (!result.ok) {
    return sendError(res, 400, "Validation failed", result.message);
  }
  return sendSuccess(res, 200, { perStore: result.perStore, period: result.period });
}
