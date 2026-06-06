import mongoose from "mongoose";
import AiQuotationSession from "../Schema/AiQuotationSession.js";
import Rfq from "../Schema/Rfq.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { getQuotationAiProvider } from "../Integrations/quotationAi/index.js";
import {
  loadAssignedActiveRfq,
  loadOwnQuotation,
  createOrUpsertDraft,
  mergePricing,
  mergeTerms,
  applyComputed,
} from "../Services/quotationService.js";
import { getPeerStats } from "../Services/quotationPeerStatsService.js";
import {
  AI_SESSION_MODE,
  AI_SESSION_STATUS,
  QUOTATION_STATUS,
  QUOTATION_SOURCE,
  QUOTATION_AI_CONFIG,
} from "../../config/constants.js";

function vendorCtx(req) {
  return {
    tenantId: req.tenantId,
    vendorId: req.membership?.vendorId,
    vendorUserId: req.userId,
  };
}

function ttl() {
  return new Date(Date.now() + QUOTATION_AI_CONFIG.sessionTtlS * 1000);
}

async function loadOwnSession({ tenantId, vendorUserId, id }) {
  if (!mongoose.isValidObjectId(id)) return null;
  return AiQuotationSession.findOne({ _id: id, tenantId, vendorUserId });
}

// ---------------------------------------------------------------------------
// POST /quotations/ai/sessions — start a generate session (FR-2)
// ---------------------------------------------------------------------------
export async function startSession(req, res) {
  const { tenantId, vendorId, vendorUserId } = vendorCtx(req);
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const rfq = await loadAssignedActiveRfq({ tenantId, rfqId: req.validated.rfqId, vendorId });
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found, closed, or not assigned to you");

  const provider = getQuotationAiProvider();
  const questions = await provider.generateQuestions(rfq, { vendorId });

  // one open generate session per {rfqId, vendorUserId}
  const session = await AiQuotationSession.findOneAndUpdate(
    { tenantId, rfqId: rfq._id, vendorUserId, mode: AI_SESSION_MODE.GENERATE },
    {
      $set: {
        tenantId,
        rfqId: rfq._id,
        vendorId,
        vendorUserId,
        mode: AI_SESSION_MODE.GENERATE,
        status: AI_SESSION_STATUS.OPEN,
        provider: QUOTATION_AI_CONFIG.provider,
        questions,
        expiresAt: ttl(),
      },
    },
    { new: true, upsert: true }
  );
  return sendSuccess(res, 201, { session: session.toObject() });
}

// ---------------------------------------------------------------------------
// POST /quotations/ai/sessions/:id/answers (FR-3)
// ---------------------------------------------------------------------------
export async function answerSession(req, res) {
  const { tenantId, vendorUserId } = vendorCtx(req);
  const session = await loadOwnSession({ tenantId, vendorUserId, id: req.params.id });
  if (!session) return sendError(res, 404, "Not found", "Session not found");

  const validIds = new Set(session.questions.map((q) => q.id));
  const answers = req.validated.answers.filter((a) => validIds.has(a.questionId));
  // merge by questionId (latest wins)
  const merged = new Map(session.answers.map((a) => [a.questionId, a]));
  for (const a of answers) merged.set(a.questionId, { ...a, answeredAt: new Date() });
  session.answers = Array.from(merged.values());
  session.status = AI_SESSION_STATUS.ANSWERED;
  session.expiresAt = ttl();
  await session.save();
  return sendSuccess(res, 200, { session: session.toObject() });
}

// ---------------------------------------------------------------------------
// POST /quotations/ai/sessions/:id/generate — answers → draft (FR-4)
// ---------------------------------------------------------------------------
export async function generateDraft(req, res) {
  const { tenantId, vendorId, vendorUserId } = vendorCtx(req);
  const session = await loadOwnSession({ tenantId, vendorUserId, id: req.params.id });
  if (!session) return sendError(res, 404, "Not found", "Session not found");

  const rfq = await loadAssignedActiveRfq({ tenantId, rfqId: session.rfqId, vendorId });
  if (!rfq) return sendError(res, 409, "rfq_closed", "RFQ is closed or you are no longer assigned");

  const provider = getQuotationAiProvider();
  let candidate;
  try {
    candidate = await provider.draftFromAnswers(rfq, session.answers, { vendorId });
  } catch (err) {
    if (err.code === "AI_UNAVAILABLE")
      return sendError(res, 503, "ai_unavailable", "AI provider unavailable; build manually");
    throw err;
  }

  // map AI candidate → pricing-only payload (server seeds identity from RFQ)
  const pricingItems = (candidate.items || []).map((it) => ({
    rfqItemId: String(it.rfqItemId),
    unitPrice: it.unitPrice ?? null,
    taxRatePct: it.taxRatePct ?? 0,
    discountPct: it.discountPct ?? 0,
  }));

  let quotation;
  try {
    quotation = await createOrUpsertDraft({
      tenantId,
      rfq,
      vendorId,
      vendorUserId,
      pricingItems,
      terms: candidate.terms || {},
      currency: candidate.currency,
      source: QUOTATION_SOURCE.AI_GENERATED,
      aiSessionId: session._id,
    });
  } catch (err) {
    if (err.code === "immutable_after_submit")
      return sendError(res, 409, "immutable_after_submit", "Already submitted; cannot regenerate");
    throw err;
  }

  session.draftQuotationId = quotation._id;
  session.status = AI_SESSION_STATUS.DRAFTED;
  session.expiresAt = ttl();
  await session.save();

  return sendSuccess(res, 200, { quotation: quotation.toObject(), candidate });
}

// ---------------------------------------------------------------------------
// POST /quotations/:id/ai/enhance — score + suggestions (FR-5/7). Read-only.
// ---------------------------------------------------------------------------
export async function enhanceQuotation(req, res) {
  const { tenantId, vendorId, vendorUserId } = vendorCtx(req);
  const quotation = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");

  const rfq = await Rfq.findOne({ _id: quotation.rfqId, tenantId }).lean();
  if (!rfq) return sendError(res, 404, "Not found", "RFQ not found");
  // vendor must still be assigned to use enhance
  if (!(rfq.assignedVendors || []).some((v) => String(v) === String(vendorId)))
    return sendError(res, 403, "Forbidden", "You are no longer assigned to this RFQ");

  let peerStats = {};
  try {
    peerStats = await getPeerStats({ tenantId, rfqId: rfq._id, excludeVendorId: vendorId });
  } catch {
    peerStats = {};
  }

  const provider = getQuotationAiProvider();
  const result = await provider.enhance(quotation.toObject(), rfq, peerStats, { vendorId });

  await AiQuotationSession.findOneAndUpdate(
    { tenantId, rfqId: rfq._id, vendorUserId, mode: AI_SESSION_MODE.ENHANCE },
    {
      $set: {
        tenantId,
        rfqId: rfq._id,
        vendorId,
        vendorUserId,
        mode: AI_SESSION_MODE.ENHANCE,
        status: AI_SESSION_STATUS.OPEN,
        provider: QUOTATION_AI_CONFIG.provider,
        draftQuotationId: quotation._id,
        lastScore: result.score,
        suggestions: result.suggestions,
        findings: result.findings,
        expiresAt: ttl(),
      },
    },
    { new: true, upsert: true }
  );

  const peerInsufficient = Object.keys(peerStats).length === 0;
  return sendSuccess(res, 200, {
    score: result.score,
    findings: result.findings,
    suggestions: result.suggestions,
    peerStatsAvailable: !peerInsufficient,
  });
}

// ---------------------------------------------------------------------------
// POST /quotations/:id/ai/apply — accept suggestions → core PATCH (FR-6)
// ---------------------------------------------------------------------------
export async function applySuggestions(req, res) {
  const { tenantId, vendorId, vendorUserId } = vendorCtx(req);
  const quotation = await loadOwnQuotation({ tenantId, vendorId, id: req.params.id });
  if (!quotation) return sendError(res, 404, "Not found", "Quotation not found");
  if (quotation.status !== QUOTATION_STATUS.DRAFT)
    return sendError(res, 409, "immutable_after_submit", `Cannot edit a ${quotation.status} quotation`);

  const rfq = await loadAssignedActiveRfq({ tenantId, rfqId: quotation.rfqId, vendorId });
  if (!rfq) return sendError(res, 409, "rfq_closed", "RFQ is closed or you are no longer assigned");

  const session = await AiQuotationSession.findOne({
    tenantId,
    rfqId: quotation.rfqId,
    vendorUserId,
    mode: AI_SESSION_MODE.ENHANCE,
  });
  if (!session) return sendError(res, 422, "no_enhance_session", "Run enhance before applying suggestions");

  const byId = new Map(session.suggestions.map((s) => [s.id, s]));
  const pricingItems = [];
  const termPatch = {};
  for (const sid of req.validated.suggestionIds) {
    const s = byId.get(sid);
    if (!s) return sendError(res, 422, "unknown_suggestion", `Unknown suggestion: ${sid}`);
    if (s.proposed === null || s.proposed === undefined) continue; // advisory-only
    if (s.field && s.field.startsWith("items.") && s.field.endsWith(".unitPrice")) {
      pricingItems.push({ rfqItemId: String(s.rfqItemId), unitPrice: s.proposed });
    } else if (s.field === "terms.deliveryDate") {
      termPatch.deliveryDate = s.proposed;
    } else if (s.field === "terms.paymentDays") {
      termPatch.paymentDays = s.proposed;
    }
  }

  if (pricingItems.length) mergePricing(quotation.items, pricingItems);
  if (Object.keys(termPatch).length) quotation.terms = mergeTerms(quotation.terms, termPatch);
  quotation.source = QUOTATION_SOURCE.AI_ENHANCED;
  quotation.aiSessionId = session._id;
  applyComputed(quotation);
  await quotation.save();
  return sendSuccess(res, 200, { quotation: quotation.toObject() });
}
