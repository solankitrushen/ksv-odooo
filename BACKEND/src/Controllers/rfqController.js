import { RFQ_STATUS, VB_ROLES, VENDOR_STATUS } from "../../config/constants.js";
import { nextRfqReference } from "../Services/rfqReferenceService.js";
import { logActivity } from "../Services/activityService.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import Rfq from "../Schema/Rfq.js";
import Vendor from "../Schema/Vendor.js";

function isStaff(roles = []) {
  return roles.includes(VB_ROLES.ADMIN) || roles.includes(VB_ROLES.OFFICER) || roles.includes(VB_ROLES.MANAGER);
}

export async function createRfq(req, res) {
  const { tenantId, userId } = req;
  const { assignedVendorIds, ...data } = req.validated;

  if (assignedVendorIds.length) {
    const validCount = await Vendor.countDocuments({
      _id: { $in: assignedVendorIds },
      tenantId,
      status: VENDOR_STATUS.ACTIVE,
    });
    if (validCount !== new Set(assignedVendorIds).size) {
      return sendError(
        res,
        400,
        "Invalid vendors",
        "One or more vendors are unknown, inactive, or from another tenant"
      );
    }
  }

  const reference = await nextRfqReference(tenantId);
  const rfq = await Rfq.create({
    ...data,
    assignedVendors: assignedVendorIds,
    reference,
    tenantId,
    createdBy: userId,
  });

  logActivity({
    tenantId,
    type: "rfq",
    action: "created",
    message: `RFQ ${rfq.reference} created: ${rfq.title}`,
    severity: "success",
    actorId: userId,
    rfqId: rfq._id,
  });

  return sendSuccess(res, 201, { rfq });
}

export async function listRfqs(req, res) {
  const { tenantId, roles, membership } = req;
  const { status, page = 1, pageSize = 20 } = req.validatedQuery || {};
  const filter = { tenantId };
  if (status) filter.status = status;
  if (!isStaff(roles)) {
    filter.assignedVendors = membership?.vendorId;
    filter.status = RFQ_STATUS.ACTIVE;
  }
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    Rfq.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Rfq.countDocuments(filter),
  ]);
  return sendSuccess(res, 200, { items, total, page, pageSize });
}

export async function getRfq(req, res) {
  const { tenantId, roles, membership } = req;
  const filter = { _id: req.params.id, tenantId };
  if (!isStaff(roles)) {
    filter.assignedVendors = membership?.vendorId;
    filter.status = RFQ_STATUS.ACTIVE;
  }
  const rfq = await Rfq.findOne(filter).lean();
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");
  return sendSuccess(res, 200, { rfq });
}
