import mongoose from "mongoose";
import Rfq from "../Schema/Rfq.js";
import Quotation from "../Schema/Quotation.js";
import PurchaseOrder from "../Schema/PurchaseOrder.js";
import Invoice from "../Schema/Invoice.js";
import Ticket from "../Schema/Ticket.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { streamPoPdf } from "../Services/purchaseOrderService.js";
import { streamInvoicePdf } from "../Services/invoiceService.js";
import { addMessage } from "../Services/ticketService.js";
import { TICKET_STATUS } from "../../config/constants.js";

function vendorCtx(req) {
  return { tenantId: req.tenantId, vendorId: req.membership?.vendorId };
}

async function withRfqRefs(tenantId, rows) {
  const ids = [...new Set(rows.map((r) => String(r.rfqId)))];
  const rfqs = await Rfq.find({ tenantId, _id: { $in: ids } })
    .select("reference title")
    .lean();
  const m = new Map(rfqs.map((r) => [String(r._id), r]));
  return rows.map((r) => ({ ...r, rfq: m.get(String(r.rfqId)) || null }));
}

// GET /vb/vendor/quotations
export async function listMyQuotations(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const rows = await Quotation.find({ tenantId, vendorId })
    .sort({ updatedAt: -1 })
    .lean();
  return sendSuccess(res, 200, { items: await withRfqRefs(tenantId, rows), total: rows.length });
}

// GET /vb/vendor/purchase-orders
export async function listMyPurchaseOrders(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const rows = await PurchaseOrder.find({ tenantId, vendorId }).sort({ createdAt: -1 }).lean();
  return sendSuccess(res, 200, { items: await withRfqRefs(tenantId, rows), total: rows.length });
}

// GET /vb/vendor/purchase-orders/:id/download
export async function downloadMyPurchaseOrder(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, "Not found", "PO not found");
  const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId, vendorId }).lean();
  if (!po) return sendError(res, 404, "Not found", "PO not found");
  const rfq = await Rfq.findOne({ _id: po.rfqId, tenantId }).lean();
  return streamPoPdf(res, po, { rfq });
}

// GET /vb/vendor/invoices
export async function listMyInvoices(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const rows = await Invoice.find({ tenantId, vendorId }).sort({ createdAt: -1 }).lean();
  return sendSuccess(res, 200, { items: await withRfqRefs(tenantId, rows), total: rows.length });
}

// GET /vb/vendor/invoices/:id/download
export async function downloadMyInvoice(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, "Not found", "Invoice not found");
  const invoice = await Invoice.findOne({ _id: req.params.id, tenantId, vendorId }).lean();
  if (!invoice) return sendError(res, 404, "Not found", "Invoice not found");
  const rfq = await Rfq.findOne({ _id: invoice.rfqId, tenantId }).lean();
  return streamInvoicePdf(res, invoice, { rfq });
}

// GET /vb/vendor/tickets
export async function listMyTickets(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const rows = await Ticket.find({ tenantId, vendorId }).sort({ updatedAt: -1 }).lean();
  return sendSuccess(res, 200, { items: await withRfqRefs(tenantId, rows), total: rows.length });
}

// GET /vb/vendor/tickets/:id
export async function getMyTicket(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, "Not found", "Ticket not found");
  const ticket = await Ticket.findOne({ _id: req.params.id, tenantId, vendorId });
  if (!ticket) return sendError(res, 404, "Not found", "Ticket not found");
  const rfq = await Rfq.findOne({ _id: ticket.rfqId, tenantId }).select("reference title").lean();
  return sendSuccess(res, 200, { ticket: { ...ticket.toObject(), rfq } });
}

// POST /vb/vendor/tickets/:id/reply
export async function replyMyTicket(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, "Not found", "Ticket not found");
  const ticket = await Ticket.findOne({ _id: req.params.id, tenantId, vendorId });
  if (!ticket) return sendError(res, 404, "Not found", "Ticket not found");
  if (ticket.status === TICKET_STATUS.CLOSED || ticket.status === TICKET_STATUS.RESOLVED)
    return sendError(res, 409, "ticket_closed", "Cannot reply to a closed ticket");
  await addMessage({ ticket, authorRole: "vendor", authorId: req.userId, body: req.validated.body });
  return sendSuccess(res, 200, { ticket: ticket.toObject() });
}
