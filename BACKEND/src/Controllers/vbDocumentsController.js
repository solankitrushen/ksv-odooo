import mongoose from "mongoose";
import PurchaseOrder from "../Schema/PurchaseOrder.js";
import Invoice from "../Schema/Invoice.js";
import Rfq from "../Schema/Rfq.js";
import Vendor from "../Schema/Vendor.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { streamPoPdf } from "../Services/purchaseOrderService.js";
import { buildInvoicePdfBuffer } from "../Services/invoiceService.js";
import { sendVendorEmail } from "../Services/vbMailer.js";
import { logActivity } from "../Services/activityService.js";
import { logger } from "../Utils/logger.js";
import { INVOICE_STATUS, VB_ROLES } from "../../config/constants.js";

function isStaff(roles = []) {
  return (
    roles.includes(VB_ROLES.ADMIN) ||
    roles.includes(VB_ROLES.OFFICER) ||
    roles.includes(VB_ROLES.MANAGER)
  );
}

async function decorate(tenantId, rows) {
  const vendorIds = [...new Set(rows.map((r) => String(r.vendorId)))];
  const rfqIds = [...new Set(rows.map((r) => String(r.rfqId)))];
  const [vendors, rfqs] = await Promise.all([
    Vendor.find({ tenantId, _id: { $in: vendorIds } }).select("name category").lean(),
    Rfq.find({ tenantId, _id: { $in: rfqIds } }).select("reference title").lean(),
  ]);
  const vMap = new Map(vendors.map((v) => [String(v._id), v]));
  const rMap = new Map(rfqs.map((r) => [String(r._id), r]));
  return rows.map((r) => ({
    ...r,
    vendor: vMap.get(String(r.vendorId)) || null,
    rfq: rMap.get(String(r.rfqId)) || null,
  }));
}

// --- Purchase orders -------------------------------------------------------
export async function listPurchaseOrders(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const filter = { tenantId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await PurchaseOrder.find(filter).sort({ createdAt: -1 }).limit(300).lean();
  return sendSuccess(res, 200, { items: await decorate(tenantId, rows), total: rows.length });
}

export async function downloadPurchaseOrder(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, "Not found", "PO not found");
  const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId }).lean();
  if (!po) return sendError(res, 404, "Not found", "PO not found");
  const rfq = await Rfq.findOne({ _id: po.rfqId, tenantId }).lean();
  const vendor = await Vendor.findOne({ _id: po.vendorId, tenantId }).lean();
  return streamPoPdf(res, po, { rfq, vendor });
}

// --- Invoices --------------------------------------------------------------
export async function listInvoices(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const filter = { tenantId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await Invoice.find(filter).sort({ createdAt: -1 }).limit(300).lean();
  return sendSuccess(res, 200, { items: await decorate(tenantId, rows), total: rows.length });
}

export async function downloadInvoiceById(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, "Not found", "Invoice not found");
  const invoice = await Invoice.findOne({ _id: req.params.id, tenantId }).lean();
  if (!invoice) return sendError(res, 404, "Not found", "Invoice not found");
  const rfq = await Rfq.findOne({ _id: invoice.rfqId, tenantId }).lean();
  const vendor = await Vendor.findOne({ _id: invoice.vendorId, tenantId }).lean();
  const { streamInvoicePdf } = await import("../Services/invoiceService.js");
  return streamInvoicePdf(res, invoice, { rfq, vendor });
}

/** Email the invoice PDF to the vendor (spec: send invoice via email). */
export async function emailInvoice(req, res) {
  const { tenantId, roles, userId } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, "Not found", "Invoice not found");
  const invoice = await Invoice.findOne({ _id: req.params.id, tenantId }).lean();
  if (!invoice) return sendError(res, 404, "Not found", "Invoice not found");
  if (invoice.status === INVOICE_STATUS.CANCELLED)
    return sendError(res, 409, "invoice_cancelled", "Cannot email a cancelled invoice");

  const rfq = await Rfq.findOne({ _id: invoice.rfqId, tenantId }).lean();
  const vendor = await Vendor.findOne({ _id: invoice.vendorId, tenantId }).lean();
  if (!vendor?.email) return sendError(res, 422, "no_vendor_email", "Vendor has no email on file");

  const pdf = await buildInvoicePdfBuffer(invoice, { rfq, vendor });
  const result = await sendVendorEmail({
    to: vendor.email,
    subject: `Invoice ${invoice.number} from your buyer`,
    text: `Please find attached invoice ${invoice.number} for ${rfq?.reference || "your order"}.`,
    attachments: [{ filename: `${invoice.number}.pdf`, content: pdf }],
  }).catch((err) => {
    logger.warn("invoice email failed", { error: err.message });
    return { sent: false };
  });

  if (result.sent) {
    logActivity({
      tenantId,
      type: "invoice",
      action: "emailed",
      message: `Invoice ${invoice.number} emailed to ${vendor.name}`,
      severity: "info",
      actorId: userId,
      actorRole: "admin",
      rfqId: invoice.rfqId,
      vendorId: invoice.vendorId,
    });
  }

  return sendSuccess(res, 200, {
    sent: result.sent,
    to: vendor.email,
    message: result.sent
      ? "Invoice emailed"
      : "SMTP not configured — email not sent. Configure SMTP_* in the backend to enable sending.",
  });
}
