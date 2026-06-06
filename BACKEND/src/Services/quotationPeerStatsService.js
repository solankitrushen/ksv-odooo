import Quotation from "../Schema/Quotation.js";
import { QUOTATION_STATUS, QUOTATION_AI_CONFIG } from "../../config/constants.js";

/**
 * quotationPeerStatsService — anonymized, aggregate-only peer pricing for the
 * AI enhance feature (SPEC-VB-003-AI FR-12 / NFR-5).
 *
 * Returns ONLY aggregates (count, median, min, max) per rfqItemId, computed
 * across OTHER vendors' SUBMITTED quotations. Never exposes a vendor identity
 * or a raw individual quote. Requires >= AI_PEER_MIN_SAMPLES priced peers per
 * item, else that item is omitted (caller treats as peer_stats_insufficient).
 */
export async function getPeerStats({ tenantId, rfqId, excludeVendorId }) {
  const peers = await Quotation.find({
    tenantId,
    rfqId,
    status: QUOTATION_STATUS.SUBMITTED,
    vendorId: { $ne: excludeVendorId },
  })
    .select("items.rfqItemId items.unitPrice")
    .lean();

  // bucket priced unit prices per rfqItemId
  const buckets = new Map();
  for (const q of peers) {
    for (const item of q.items || []) {
      if (item.unitPrice === null || item.unitPrice === undefined) continue;
      const key = String(item.rfqItemId);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item.unitPrice);
    }
  }

  const minSamples = QUOTATION_AI_CONFIG.peerMinSamples;
  const stats = {};
  for (const [key, prices] of buckets.entries()) {
    if (prices.length < minSamples) continue; // privacy: not enough peers
    prices.sort((a, b) => a - b);
    stats[key] = {
      count: prices.length,
      median: median(prices),
      min: prices[0],
      max: prices[prices.length - 1],
    };
  }
  return stats;
}

function median(sorted) {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export default { getPeerStats };
