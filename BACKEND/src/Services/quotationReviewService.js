import Quotation from "../Schema/Quotation.js";
import { getQuotationAiProvider } from "../Integrations/quotationAi/index.js";
import { getPeerStats } from "./quotationPeerStatsService.js";
import {
  AI_RECOMMENDATION,
  QUOTATION_APPROVAL_STATUS,
  QUOTATION_STATUS,
  REVIEW_CONFIG,
} from "../../config/constants.js";

/** Map an AI score (0..100) to a recommendation using REVIEW_CONFIG thresholds. */
export function recommendationFromScore(score) {
  if (score >= REVIEW_CONFIG.approveAtOrAbove) return AI_RECOMMENDATION.APPROVE;
  if (score < REVIEW_CONFIG.rejectBelow) return AI_RECOMMENDATION.REJECT;
  return AI_RECOMMENDATION.REVIEW;
}

/**
 * AI-score one submitted quotation and persist the advisory recommendation on
 * its approval block. Does NOT change approval.status (a human decides) and
 * never touches money. Returns the updated lean approval block.
 */
export async function reviewQuotation({ tenantId, rfq, quotation }) {
  const provider = getQuotationAiProvider();

  let peerStats = {};
  try {
    peerStats = await getPeerStats({
      tenantId,
      rfqId: rfq._id,
      excludeVendorId: quotation.vendorId,
    });
  } catch {
    peerStats = {};
  }

  const result = await provider.enhance(
    quotation.toObject ? quotation.toObject() : quotation,
    rfq,
    peerStats,
    {}
  );
  const score = Number(result.score) || 0;
  const recommendation = recommendationFromScore(score);

  quotation.approval = {
    ...(quotation.approval?.toObject ? quotation.approval.toObject() : quotation.approval),
    status: quotation.approval?.status || QUOTATION_APPROVAL_STATUS.PENDING,
    aiScore: score,
    aiRecommendation: recommendation,
    aiFindings: result.findings || [],
    aiReviewedAt: new Date(),
  };
  await quotation.save();
  return {
    quotationId: quotation._id,
    vendorId: quotation.vendorId,
    aiScore: score,
    aiRecommendation: recommendation,
    findings: result.findings || [],
  };
}

/**
 * Auto-review every SUBMITTED + still-PENDING quotation on an RFQ. Returns a
 * summary list sorted by score desc (best candidate first).
 */
export async function autoReviewRfq({ tenantId, rfq }) {
  const quotations = await Quotation.find({
    tenantId,
    rfqId: rfq._id,
    status: QUOTATION_STATUS.SUBMITTED,
  });

  const results = [];
  for (const q of quotations) {
    // skip already-decided ones (keep their human decision intact)
    if (q.approval?.status && q.approval.status !== QUOTATION_APPROVAL_STATUS.PENDING) {
      results.push({
        quotationId: q._id,
        vendorId: q.vendorId,
        aiScore: q.approval.aiScore,
        aiRecommendation: q.approval.aiRecommendation,
        findings: q.approval.aiFindings || [],
        skipped: true,
      });
      continue;
    }
    results.push(await reviewQuotation({ tenantId, rfq, quotation: q }));
  }

  results.sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
  return { reviewed: results.length, results };
}
