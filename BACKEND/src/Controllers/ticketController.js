import mongoose from "mongoose";
import Ticket from "../Schema/Ticket.js";
import Vendor from "../Schema/Vendor.js";
import Rfq from "../Schema/Rfq.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { addMessage, closeTicket, createTicket } from "../Services/ticketService.js";
import { sendVendorEmail } from "../Services/vbMailer.js";
import { logger } from "../Utils/logger.js";
import { TICKET_STATUS, VB_ROLES } from "../../config/constants.js";

function isStaff(roles = []) {
  return (
    roles.includes(VB_ROLES.ADMIN) ||
    roles.includes(VB_ROLES.OFFICER) ||
    roles.includes(VB_ROLES.MANAGER)
  );
}

async function loadTicket(tenantId, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Ticket.findOne({ _id: id, tenantId });
}

// GET /vb/tickets?status=&vendorId=&rfqId=
export async function listTickets(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const { status, vendorId, rfqId } = req.query || {};
  const filter = { tenantId };
  if (status) filter.status = status;
  if (vendorId && mongoose.isValidObjectId(vendorId)) filter.vendorId = vendorId;
  if (rfqId && mongoose.isValidObjectId(rfqId)) filter.rfqId = rfqId;

  const items = await Ticket.find(filter).sort({ updatedAt: -1 }).limit(200).lean();

  // decorate with vendor name + rfq reference
  const vendorIds = [...new Set(items.map((t) => String(t.vendorId)))];
  const rfqIds = [...new Set(items.map((t) => String(t.rfqId)))];
  const [vendors, rfqs] = await Promise.all([
    Vendor.find({ tenantId, _id: { $in: vendorIds } }).select("name").lean(),
    Rfq.find({ tenantId, _id: { $in: rfqIds } }).select("reference title").lean(),
  ]);
  const vMap = new Map(vendors.map((v) => [String(v._id), v]));
  const rMap = new Map(rfqs.map((r) => [String(r._id), r]));
  const decorated = items.map((t) => ({
    ...t,
    vendor: vMap.get(String(t.vendorId)) || null,
    rfq: rMap.get(String(t.rfqId)) || null,
  }));

  return sendSuccess(res, 200, { items: decorated, total: decorated.length });
}

// GET /vb/tickets/:id
export async function getTicket(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const ticket = await loadTicket(tenantId, req.params.id);
  if (!ticket) return sendError(res, 404, "Not found", "Ticket not found");
  const [vendor, rfq] = await Promise.all([
    Vendor.findOne({ _id: ticket.vendorId, tenantId }).select("name email").lean(),
    Rfq.findOne({ _id: ticket.rfqId, tenantId }).select("reference title").lean(),
  ]);
  return sendSuccess(res, 200, { ticket: { ...ticket.toObject(), vendor, rfq } });
}

// POST /vb/tickets  (manual)
export async function createTicketHandler(req, res) {
  const { tenantId, roles, userId } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const { rfqId, quotationId, vendorId, type, subject, body, priority } = req.validated;

  const rfq = await Rfq.findOne({ _id: rfqId, tenantId }).lean();
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");
  const vendor = await Vendor.findOne({ _id: vendorId, tenantId }).lean();
  if (!vendor) return sendError(res, 404, "Not found", "Vendor not found");

  const ticket = await createTicket({
    tenantId,
    rfqId,
    quotationId: quotationId || null,
    vendorId,
    type,
    subject,
    body,
    priority,
    createdBy: userId,
  });

  if (vendor.email && body) {
    sendVendorEmail({ to: vendor.email, subject, text: body }).catch((err) =>
      logger.warn("ticket email failed", { error: err.message })
    );
  }
  return sendSuccess(res, 201, { ticket: ticket.toObject() });
}

// POST /vb/tickets/:id/reply
export async function replyTicket(req, res) {
  const { tenantId, roles, userId } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const ticket = await loadTicket(tenantId, req.params.id);
  if (!ticket) return sendError(res, 404, "Not found", "Ticket not found");
  if (ticket.status === TICKET_STATUS.CLOSED || ticket.status === TICKET_STATUS.RESOLVED)
    return sendError(res, 409, "ticket_closed", "Cannot reply to a closed ticket");

  await addMessage({ ticket, authorRole: "admin", authorId: userId, body: req.validated.body });

  const vendor = await Vendor.findOne({ _id: ticket.vendorId, tenantId }).lean();
  if (vendor?.email) {
    sendVendorEmail({
      to: vendor.email,
      subject: `Re: ${ticket.subject}`,
      text: req.validated.body,
    }).catch((err) => logger.warn("ticket reply email failed", { error: err.message }));
  }
  return sendSuccess(res, 200, { ticket: ticket.toObject() });
}

// POST /vb/tickets/:id/close
export async function closeTicketHandler(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const ticket = await loadTicket(tenantId, req.params.id);
  if (!ticket) return sendError(res, 404, "Not found", "Ticket not found");
  await closeTicket({ ticket, resolved: req.body?.resolved !== false });
  return sendSuccess(res, 200, { ticket: ticket.toObject() });
}
