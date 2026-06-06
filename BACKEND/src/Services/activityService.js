import ActivityLog from "../Schema/ActivityLog.js";
import { logger } from "../Utils/logger.js";

/**
 * Record an activity/audit event. Fire-and-forget: failures are logged but
 * never bubble up to break the primary request flow.
 */
export async function logActivity({
  tenantId,
  type,
  action,
  message,
  severity = "info",
  actorId = null,
  actorRole = null,
  rfqId = null,
  vendorId = null,
  quotationId = null,
  meta = null,
}) {
  try {
    await ActivityLog.create({
      tenantId,
      type,
      action,
      message,
      severity,
      actorId,
      actorRole,
      rfqId,
      vendorId,
      quotationId,
      meta,
    });
  } catch (err) {
    logger.warn("activity log failed", { error: err.message, type, action });
  }
}

export async function listActivity({ tenantId, type, limit = 100 }) {
  const filter = { tenantId };
  if (type && type !== "all") filter.type = type;
  return ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 300))
    .lean();
}
