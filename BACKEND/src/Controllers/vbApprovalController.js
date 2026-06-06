import mongoose from "mongoose";
import Quotation from "../Schema/Quotation.js";
import Rfq from "../Schema/Rfq.js";
import Vendor from "../Schema/Vendor.js";
import Invoice from "../Schema/Invoice.js";
import Tenant from "../Schema/Tenant.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { autoReviewRfq } from "../Services/quotationReviewService.js";
import {
  generateInvoiceForQuotation,
  streamInvoicePdf,
} from "../Services/invoiceService.js";
import { generatePurchaseOrder } from "../Services/purchaseOrderService.js";
import { buildBargainDraft, createTicket } from "../Services/ticketService.js";
import { logActivity } from "../Services/activityService.js";
import { sendVendorEmail } from "../Services/vbMailer.js";
import { logger } from "../Utils/logger.js";
import {
  QUOTATION_APPROVAL_STATUS,
  QUOTATION_STATUS,
  TICKET_TYPE,
  VB_ROLES,
} from "../../config/constants.js";

function isStaff(roles = []) {
  return (
    roles.includes(VB_ROLES.ADMIN) ||
    roles.includes(VB_ROLES.OFFICER) ||
    roles.includes(VB_ROLES.MANAGER)
  );
}

async function loadRfq(tenantId, rfqId) {
  if (!mongoose.isValidObjectId(rfqId)) return null;
  return Rfq.findOne({ _id: rfqId, tenantId });
}

async function loadSubmittedQuotation(tenantId, rfqId, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Quotation.findOne({ _id: id, rfqId, tenantId });
}

// ---------------------------------------------------------------------------
// POST /vb/rfq/:rfqId/auto-review — AI-score all submitted quotations
// ---------------------------------------------------------------------------
export async function autoReview(req, res) {
  const { tenantId, roles, userId } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const rfq = await loadRfq(tenantId, req.params.rfqId);
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");

  const summary = await autoReviewRfq({ tenantId, rfq });

  logActivity({
    tenantId,
    type: "rfq",
    action: "auto_reviewed",
    message: `AI auto-reviewed ${summary.reviewed} quotation(s) on ${rfq.reference}`,
    severity: "info",
    actorId: userId,
    actorRole: "admin",
    rfqId: rfq._id,
    meta: { reviewed: summary.reviewed },
  });

  return sendSuccess(res, 200, summary);
}

// ---------------------------------------------------------------------------
// POST /vb/rfq/:rfqId/quotations/:id/approve — approve + auto-invoice
// ---------------------------------------------------------------------------
export async function approveQuotation(req, res) {
  const { tenantId, roles, userId } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const rfq = await loadRfq(tenantId, req.params.rfqId);
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");
  const quotation = await loadSubmittedQuotation(tenantId, rfq._id, req.params.id);
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");
  if (quotation.status !== QUOTATION_STATUS.SUBMITTED)
    return sendError(res, 409, "not_submitted", "Only submitted quotations can be approved");
  if (quotation.approval?.status === QUOTATION_APPROVAL_STATUS.APPROVED)
    return sendError(res, 409, "already_approved", "Quotation already approved");

  // generate PO first (spec: approved quotation -> PO), then invoice from PO
  const po = await generatePurchaseOrder({ tenantId, rfq, quotation, issuedBy: userId });
  const invoice = await generateInvoiceForQuotation({
    tenantId,
    rfq,
    quotation,
    issuedBy: userId,
  });
  if (!po.invoiceId) {
    po.invoiceId = invoice._id;
    await po.save();
  }

  quotation.approval.status = QUOTATION_APPROVAL_STATUS.APPROVED;
  quotation.approval.decidedBy = userId;
  quotation.approval.decidedAt = new Date();
  quotation.approval.reason = req.validated?.reason || null;
  quotation.approval.invoiceId = invoice._id;
  await quotation.save();

  // email the vendor (best-effort)
  const vendor = await Vendor.findOne({ _id: quotation.vendorId, tenantId }).lean();
  const tenant = await Tenant.findById(tenantId).lean();
  if (vendor?.email) {
    sendVendorEmail({
      to: vendor.email,
      subject: `Your quotation for ${rfq.reference} was approved`,
      text: `Good news — your quotation for "${rfq.title}" (${rfq.reference}) has been approved by ${tenant?.name || "the buyer"}. Purchase order ${po.number} and invoice ${invoice.number} have been generated.`,
    }).catch((err) => logger.warn("approve email failed", { error: err.message }));
  }

  logActivity({
    tenantId,
    type: "approval",
    action: "approved",
    message: `Quotation from ${vendor?.name || "vendor"} approved for ${rfq.reference} — PO ${po.number}, invoice ${invoice.number}`,
    severity: "success",
    actorId: userId,
    actorRole: "admin",
    rfqId: rfq._id,
    vendorId: quotation.vendorId,
    quotationId: quotation._id,
    meta: { poNumber: po.number, invoiceNumber: invoice.number, grandTotal: invoice.grandTotal },
  });

  return sendSuccess(res, 200, {
    quotation: quotation.toObject(),
    purchaseOrder: po.toObject ? po.toObject() : po,
    invoice: invoice.toObject ? invoice.toObject() : invoice,
  });
}

// ---------------------------------------------------------------------------
// POST /vb/rfq/:rfqId/quotations/:id/reject
// ---------------------------------------------------------------------------
export async function rejectQuotation(req, res) {
  const { tenantId, roles, userId } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const rfq = await loadRfq(tenantId, req.params.rfqId);
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");
  const quotation = await loadSubmittedQuotation(tenantId, rfq._id, req.params.id);
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");
  if (quotation.approval?.status === QUOTATION_APPROVAL_STATUS.APPROVED)
    return sendError(res, 409, "already_approved", "Cannot reject an approved quotation");

  quotation.approval.status = QUOTATION_APPROVAL_STATUS.REJECTED;
  quotation.approval.decidedBy = userId;
  quotation.approval.decidedAt = new Date();
  quotation.approval.reason = req.validated?.reason || null;
  await quotation.save();

  const vendor = await Vendor.findOne({ _id: quotation.vendorId, tenantId }).lean();
  if (vendor?.email) {
    sendVendorEmail({
      to: vendor.email,
      subject: `Update on your quotation for ${rfq.reference}`,
      text: `Your quotation for "${rfq.title}" (${rfq.reference}) was not selected.${req.validated?.reason ? ` Reason: ${req.validated.reason}` : ""}`,
    }).catch((err) => logger.warn("reject email failed", { error: err.message }));
  }

  logActivity({
    tenantId,
    type: "approval",
    action: "rejected",
    message: `Quotation from ${vendor?.name || "vendor"} rejected for ${rfq.reference}`,
    severity: "warn",
    actorId: userId,
    actorRole: "admin",
    rfqId: rfq._id,
    vendorId: quotation.vendorId,
    quotationId: quotation._id,
  });

  return sendSuccess(res, 200, { quotation: quotation.toObject() });
}

// ---------------------------------------------------------------------------
// POST /vb/rfq/:rfqId/quotations/:id/bargain — AI-drafted negotiation ticket
// ---------------------------------------------------------------------------
export async function bargainQuotation(req, res) {
  const { tenantId, roles, userId } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const rfq = await loadRfq(tenantId, req.params.rfqId);
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");
  const quotation = await loadSubmittedQuotation(tenantId, rfq._id, req.params.id);
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");

  const draft = await buildBargainDraft({ tenantId, rfq, quotation: quotation.toObject() });
  if (!draft)
    return sendError(res, 422, "nothing_to_bargain", "No line items qualify for a price revision request");

  const ticket = await createTicket({
    tenantId,
    rfqId: rfq._id,
    quotationId: quotation._id,
    vendorId: quotation.vendorId,
    type: TICKET_TYPE.BARGAIN,
    subject: draft.subject,
    body: draft.body,
    priority: "high",
    aiGenerated: true,
    targetUnitPrices: draft.targetUnitPrices,
    createdBy: userId,
  });

  const vendor = await Vendor.findOne({ _id: quotation.vendorId, tenantId }).lean();
  if (vendor?.email) {
    sendVendorEmail({
      to: vendor.email,
      subject: draft.subject,
      text: draft.body,
    }).catch((err) => logger.warn("bargain email failed", { error: err.message }));
  }

  logActivity({
    tenantId,
    type: "ticket",
    action: "bargain_raised",
    message: `AI bargaining ticket ${ticket.reference} raised with ${vendor?.name || "vendor"} on ${rfq.reference}`,
    severity: "info",
    actorId: userId,
    actorRole: "admin",
    rfqId: rfq._id,
    vendorId: quotation.vendorId,
    quotationId: quotation._id,
    meta: { ticketReference: ticket.reference },
  });

  return sendSuccess(res, 201, { ticket: ticket.toObject() });
}

// ---------------------------------------------------------------------------
// GET /vb/rfq/:rfqId/compare — side-by-side comparison matrix (spec screen 7)
// Returns submitted quotations, per-RFQ-item best (lowest) unit price, and the
// overall lowest grand total — all read-only from stored computed (paise).
// ---------------------------------------------------------------------------
export async function compareQuotations(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const rfq = await loadRfq(tenantId, req.params.rfqId);
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");

  const quotations = await Quotation.find({
    tenantId,
    rfqId: rfq._id,
    status: QUOTATION_STATUS.SUBMITTED,
  }).lean();

  const vendors = await Vendor.find({
    _id: { $in: quotations.map((q) => q.vendorId) },
    tenantId,
  })
    .select("name category")
    .lean();
  const vMap = new Map(vendors.map((v) => [String(v._id), v]));

  // per-RFQ-item: collect each vendor's unit price; mark the lowest
  const items = (rfq.items || []).map((it, idx) => {
    const rfqItemId = String(idx);
    const prices = quotations.map((q) => {
      const line = (q.items || []).find(
        (li) => String(li.rfqItemId) === rfqItemId
      );
      return {
        quotationId: String(q._id),
        vendorId: String(q.vendorId),
        unitPrice: line && line.unitPrice != null ? line.unitPrice : null,
        lineTotal: line ? line.lineTotal : null,
      };
    });
    const priced = prices.filter((p) => p.unitPrice != null);
    const best = priced.length
      ? priced.reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a))
      : null;
    return {
      rfqItemId,
      name: it.name,
      qty: it.qty,
      unit: it.unit,
      prices,
      bestQuotationId: best ? best.quotationId : null,
    };
  });

  // overall cheapest grand total among fully/partly covered quotes
  const ranked = [...quotations].sort(
    (a, b) => (a.computed?.grandTotal ?? Infinity) - (b.computed?.grandTotal ?? Infinity)
  );
  const lowestTotalQuotationId = ranked[0] ? String(ranked[0]._id) : null;

  return sendSuccess(res, 200, {
    rfq: { _id: rfq._id, reference: rfq.reference, title: rfq.title, deadline: rfq.deadline },
    quotations: quotations.map((q) => ({
      _id: q._id,
      vendorId: q.vendorId,
      vendor: vMap.get(String(q.vendorId)) || null,
      currency: q.currency,
      computed: q.computed,
      terms: { deliveryDate: q.terms?.deliveryDate ?? null, paymentDays: q.terms?.paymentDays ?? null, warrantyMonths: q.terms?.warrantyMonths ?? null },
      approval: { status: q.approval?.status ?? "pending", aiScore: q.approval?.aiScore ?? null, aiRecommendation: q.approval?.aiRecommendation ?? null },
    })),
    items,
    lowestTotalQuotationId,
  });
}

// ---------------------------------------------------------------------------
// GET /vb/rfq/:rfqId/quotations/:id/invoice — download invoice PDF
// ---------------------------------------------------------------------------
export async function downloadInvoice(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const { rfqId, id } = req.params;
  if (!mongoose.isValidObjectId(rfqId) || !mongoose.isValidObjectId(id))
    return sendError(res, 404, "Not found", "Invoice not found");
  const invoice = await Invoice.findOne({ tenantId, rfqId, quotationId: id }).lean();
  if (!invoice) return sendError(res, 404, "Not found", "No invoice for this quotation");
  const rfq = await Rfq.findOne({ _id: rfqId, tenantId }).lean();
  const vendor = await Vendor.findOne({ _id: invoice.vendorId, tenantId }).lean();
  return streamInvoicePdf(res, invoice, { rfq, vendor });
}
