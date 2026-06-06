import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { answer, getSnapshot } from "../Services/assistantService.js";
import { VB_ROLES } from "../../config/constants.js";

function isStaff(roles = []) {
  return (
    roles.includes(VB_ROLES.ADMIN) ||
    roles.includes(VB_ROLES.OFFICER) ||
    roles.includes(VB_ROLES.MANAGER)
  );
}

// POST /vb/assistant/chat  { message }
export async function chat(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const message = String(req.body?.message || "").slice(0, 1000);
  const snap = await getSnapshot(tenantId);
  const result = answer(message, snap);
  return sendSuccess(res, 200, { ...result, snapshot: snap });
}
