import mongoose from "mongoose";
import Quotation from "../Schema/Quotation.js";
import QuotationRevision from "../Schema/QuotationRevision.js";
import Rfq from "../Schema/Rfq.js";
import Vendor from "../Schema/Vendor.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  loadAssignedActiveRfq,
  loadOwnQuotation,
  createOrUpsertDraft,
  mergePricing,
  mergeTerms,
  applyComputed,
} from "../Services/quotationService.js";
import { canTransition, ACTIONS } from "../Services/quotationStateService.js";
import { tick } from "../Services/quotationExpiryService.js";
import { lookupIdempotency, storeIdempotency } from "../Services/idempotencyService.js";
import { streamQuotationPdf } from "../Services/quotationPdfService.js";
import { logActivity } from "../Services/activityService.js";
import {
  QUOTATION_STATUS,
  QUOTATION_SOURCE,
  VB_ROLES,
} from "../../config/constants.js";

function isStaff(roles = []) {
  return (
    roles.includes(VB_ROLES.ADMIN) ||
    roles.includes(VB_ROLES.OFFICER) ||
    roles.includes(VB_ROLES.MANAGER)
  );
}

function vendorCtx(req) {
  return {
    tenantId: req.tenantId,
    vendorId: req.membership?.vendorId,
    vendorUserId: req.userId,
  };
}

// ---------------------------------------------------------------------------
// Vendor RFQ inbox (FR-3 / FR-4)
// ---------------------------------------------------------------------------
export async function listMyRfqs(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const rfqs = await Rfq.find({
    tenantId,
    status: "active",
    assignedVendors: vendorId,
  })
    .sort({ createdAt: -1 })
    .lean();

  const quotes = await Quotation.find({
    tenantId,
    vendorId,
    rfqId: { $in: rfqs.map((r) => r._id) },
  })
    .select("rfqId status computed.grandTotal computed.coverage updatedAt")
    .lean();
  const byRfq = new Map(quotes.map((q) => [String(q.rfqId), q]));

  const items = rfqs.map((r) => ({
    ...r,
    myQuotation: byRfq.get(String(r._id)) || null,
  }));
  return sendSuccess(res, 200, { items, total: items.length });
}

export async function getMyRfq(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const rfq = await loadAssignedActiveRfq({ tenantId, rfqId: req.params.id, vendorId });
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");
  const myQuotation = await Quotation.findOne({
    tenantId,
    vendorId,
    rfqId: rfq._id,
    status: { $in: [QUOTATION_STATUS.DRAFT, QUOTATION_STATUS.SUBMITTED] },
  }).lean();
  return sendSuccess(res, 200, { rfq, myQuotation });
}

// ---------------------------------------------------------------------------
// Create / upsert draft (FR-5) — idempotent
// ---------------------------------------------------------------------------
export async function createQuotation(req, res) {
  const { tenantId, vendorId, vendorUserId } = vendorCtx(req);
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const { rfqId, currency, items, terms, aiSessionId } = req.validated;
  const idempotencyKey = req.get("Idempotency-Key") || null;
  const scope = "quotation.create";

  if (idempotencyKey) {
    const look = await lookupIdempotency({
      tenantId,
      vendorUserId,
      scope,
      key: idempotencyKey,
      body: req.validated,
    });
    if (look.status === "mismatch")
      return sendError(res, 422, "fingerprint_mismatch", "Idempotency key reused with a different body");
    if (look.status === "replay")
      return res.status(look.record.statusCode || 200).json(look.record.response);
  }

  const rfq = await loadAssignedActiveRfq({ tenantId, rfqId, vendorId });
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found, closed, or not assigned to you");

  let quotation;
  try {
    quotation = await createOrUpsertDraft({
      tenantId,
      rfq,
      vendorId,
      vendorUserId,
      pricingItems: items || [],
      terms: terms || {},
      currency,
      source: QUOTATION_SOURCE.MANUAL,
      aiSessionId: aiSessionId || null,
      idempotencyKey,
    });
  } catch (err) {
    if (err.code === "immutable_after_submit")
      return sendError(res, 409, "immutable_after_submit", "Already submitted; cannot edit prices");
    throw err;
  }

  const payload = { success: true, data: { quotation: quotation.toObject() } };
  if (idempotencyKey) {
    await storeIdempotency({
      tenantId,
      vendorUserId,
      scope,
      key: idempotencyKey,
      body: req.validated,
      statusCode: 201,
      response: payload,
    });
  }
  return res.status(201).json(payload);
}

// ---------------------------------------------------------------------------
// Patch draft (FR-6)
// ---------------------------------------------------------------------------
export async function patchQuotation(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  const quotation = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");

  if (quotation.status !== QUOTATION_STATUS.DRAFT)
    return sendError(res, 409, "immutable_after_submit", `Cannot edit a ${quotation.status} quotation`);

  // RFQ must still be active + assigned (rfq_closed / unassigned guard)
  const rfq = await loadAssignedActiveRfq({ tenantId, rfqId: quotation.rfqId, vendorId });
  if (!rfq) return sendError(res, 409, "rfq_closed", "RFQ is closed or you are no longer assigned");

  const { currency, items, terms } = req.validated;
  if (currency) quotation.currency = currency;
  if (items) mergePricing(quotation.items, items);
  if (terms) quotation.terms = mergeTerms(quotation.terms, terms);
  applyComputed(quotation);
  await quotation.save();
  return sendSuccess(res, 200, { quotation: quotation.toObject() });
}

export async function getQuotation(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  const quotation = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");
  return sendSuccess(res, 200, { quotation: quotation.toObject() });
}

// ---------------------------------------------------------------------------
// Submit (FR-7) — atomic, deadline-race safe
// ---------------------------------------------------------------------------
export async function submitQuotation(req, res) {
  const { tenantId, vendorId, vendorUserId } = vendorCtx(req);
  const idempotencyKey = req.get("Idempotency-Key") || null;
  const scope = "quotation.submit";

  if (idempotencyKey) {
    const look = await lookupIdempotency({ tenantId, vendorUserId, scope, key: idempotencyKey, body: { id: req.params.id } });
    if (look.status === "replay")
      return res.status(look.record.statusCode || 200).json(look.record.response);
  }

  const quotation = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");

  const gate = canTransition(quotation.status, ACTIONS.SUBMIT, { deadline: quotation.deadline });
  if (!gate.ok) return sendError(res, 409, gate.code, gate.message);

  // recompute + coverage gate (>0 priced item required)
  applyComputed(quotation);
  if (quotation.computed.coverage <= 0)
    return sendError(res, 422, "coverage_zero", "Price at least one item before submitting");

  // RFQ still active
  const rfq = await Rfq.findOne({ _id: quotation.rfqId, tenantId, status: "active" }).lean();
  if (!rfq) return sendError(res, 409, "rfq_closed", "RFQ is no longer active");

  const now = new Date();
  const updated = await Quotation.findOneAndUpdate(
    { _id: quotation._id, tenantId, vendorId, status: QUOTATION_STATUS.DRAFT, deadline: { $gte: now } },
    {
      $set: {
        status: QUOTATION_STATUS.SUBMITTED,
        submittedAt: now,
        "computed": quotation.computed,
        items: quotation.items,
      },
    },
    { new: true }
  );
  if (!updated) return sendError(res, 409, "deadline_passed", "Submission lost the race or deadline passed");

  logActivity({
    tenantId,
    type: "quotation",
    action: "submitted",
    message: `Quotation submitted for RFQ ${updated.rfqId}`,
    severity: "success",
    actorId: vendorUserId,
    rfqId: updated.rfqId,
    vendorId,
    quotationId: updated._id,
  });

  const payload = { success: true, data: { quotation: updated.toObject() } };
  if (idempotencyKey)
    await storeIdempotency({ tenantId, vendorUserId, scope, key: idempotencyKey, body: { id: req.params.id }, statusCode: 200, response: payload });
  return res.status(200).json(payload);
}

// ---------------------------------------------------------------------------
// Withdraw (FR-8)
// ---------------------------------------------------------------------------
export async function withdrawQuotation(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  const quotation = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");
  const gate = canTransition(quotation.status, ACTIONS.WITHDRAW, { deadline: quotation.deadline });
  if (!gate.ok) return sendError(res, 409, gate.code, gate.message);
  quotation.status = QUOTATION_STATUS.WITHDRAWN;
  quotation.withdrawnAt = new Date();
  quotation.withdrawReason = req.validated.reason;
  await quotation.save();
  return sendSuccess(res, 200, { quotation: quotation.toObject() });
}

// ---------------------------------------------------------------------------
// Reaffirm stale quote (FR-9)
// ---------------------------------------------------------------------------
export async function reaffirmQuotation(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  const quotation = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");
  const gate = canTransition(quotation.status, ACTIONS.REAFFIRM, { deadline: quotation.deadline });
  if (!gate.ok) return sendError(res, 409, gate.code, gate.message);
  quotation.staleFlag = false;
  await quotation.save();
  return sendSuccess(res, 200, { quotation: quotation.toObject() });
}

// ---------------------------------------------------------------------------
// Resubmit — clone a submitted quote into a new draft revisionOf (FR-10)
// Index-safe: the prior submitted quote is moved to withdrawn-with-history.
// ---------------------------------------------------------------------------
export async function resubmitQuotation(req, res) {
  const { tenantId, vendorId, vendorUserId } = vendorCtx(req);
  const prior = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!prior) return sendError(res, 404, "Not found", "Quotation not found");
  if (prior.status !== QUOTATION_STATUS.SUBMITTED)
    return sendError(res, 422, "not_submitted", "Only a submitted quotation can be revised");

  const rfq = await loadAssignedActiveRfq({ tenantId, rfqId: prior.rfqId, vendorId });
  if (!rfq) return sendError(res, 409, "rfq_closed", "RFQ is closed or you are no longer assigned");

  // snapshot prior, then withdraw it so only one active remains (unique index)
  const revCount = await QuotationRevision.countDocuments({ tenantId, quotationId: prior._id });
  await QuotationRevision.create({
    tenantId,
    rfqId: prior.rfqId,
    vendorId,
    quotationId: prior._id,
    revisionNumber: revCount + 1,
    snapshot: prior.toObject(),
    reason: "resubmit",
    createdBy: vendorUserId,
  });
  prior.status = QUOTATION_STATUS.WITHDRAWN;
  prior.withdrawnAt = new Date();
  prior.withdrawReason = "superseded by revision";
  await prior.save();

  const draft = new Quotation({
    tenantId,
    rfqId: prior.rfqId,
    vendorId,
    vendorUserId,
    status: QUOTATION_STATUS.DRAFT,
    currency: prior.currency,
    items: prior.items.map((it) => ({ ...it.toObject?.() ?? it })),
    terms: prior.terms,
    deadline: rfq.deadline,
    rfqVersionNumber: rfq.versionNumber || prior.rfqVersionNumber,
    source: prior.source,
    revisionOf: prior._id,
  });
  applyComputed(draft);
  await draft.save();
  return sendSuccess(res, 201, { quotation: draft.toObject() });
}

// ---------------------------------------------------------------------------
// Vendor download own quotation PDF (FR-8 AI spec)
// ---------------------------------------------------------------------------
export async function downloadOwnQuotation(req, res) {
  const { tenantId, vendorId } = vendorCtx(req);
  const quotation = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");
  const rfq = await Rfq.findOne({ _id: quotation.rfqId, tenantId }).lean();
  const vendor = await Vendor.findOne({ _id: vendorId, tenantId }).lean();
  return streamQuotationPdf(res, quotation.toObject(), { rfq, vendor, audience: "vendor" });
}

// ---------------------------------------------------------------------------
// Staff: list submitted/withdrawn quotations for an RFQ (FR-11). No drafts.
// ---------------------------------------------------------------------------
export async function staffListQuotations(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, "Not found", "RFQ not found");
  const rfq = await Rfq.findOne({ _id: req.params.id, tenantId }).lean();
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");
  await tick({ tenantId, rfqId: rfq._id });
  const items = await Quotation.find({
    tenantId,
    rfqId: rfq._id,
    status: { $in: [QUOTATION_STATUS.SUBMITTED, QUOTATION_STATUS.WITHDRAWN] },
  })
    .sort({ submittedAt: -1 })
    .lean();
  return sendSuccess(res, 200, { items, total: items.length });
}

// ---------------------------------------------------------------------------
// Staff: download a SUBMITTED quotation PDF (FR-9 AI spec). Drafts → 404.
// ---------------------------------------------------------------------------
export async function staffDownloadQuotation(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const { rfqId, id } = req.params;
  if (!mongoose.isValidObjectId(rfqId) || !mongoose.isValidObjectId(id))
    return sendError(res, 404, "Not found", "Quotation not found");
  const quotation = await Quotation.findOne({
    _id: id,
    rfqId,
    tenantId,
    status: { $in: [QUOTATION_STATUS.SUBMITTED, QUOTATION_STATUS.WITHDRAWN] },
  }).lean();
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");
  const rfq = await Rfq.findOne({ _id: rfqId, tenantId }).lean();
  const vendor = await Vendor.findOne({ _id: quotation.vendorId, tenantId }).lean();
  return streamQuotationPdf(res, quotation, { rfq, vendor, audience: "staff" });
}
