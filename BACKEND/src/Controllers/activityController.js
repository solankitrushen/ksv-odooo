import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { listActivity } from "../Services/activityService.js";
import { VB_ROLES } from "../../config/constants.js";

function isStaff(roles = []) {
  return (
    roles.includes(VB_ROLES.ADMIN) ||
    roles.includes(VB_ROLES.OFFICER) ||
    roles.includes(VB_ROLES.MANAGER)
  );
}

// GET /vb/activity?type=&limit=
export async function getActivity(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const { type, limit } = req.query || {};
  const items = await listActivity({
    tenantId,
    type,
    limit: limit ? Number(limit) : 100,
  });
  return sendSuccess(res, 200, { items, total: items.length });
}
