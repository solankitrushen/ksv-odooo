import mongoose from "mongoose";
import Quotation from "../Schema/Quotation.js";
import Rfq from "../Schema/Rfq.js";
import { computeQuotationTotals } from "./quotationTotalsService.js";
import { expireOne } from "./quotationExpiryService.js";
import {
  QUOTATION_STATUS,
  QUOTATION_SOURCE,
  QUOTATION_CONFIG,
  RFQ_STATUS,
} from "../../config/constants.js";

/**
 * quotationService — single source of truth for quotation writes shared by the
 * manual vendor controller AND the AI controller. AI never bypasses this path,
 * so totals/status/ownership are always server-controlled (SPEC-VB-003 NFR-2,
 * SPEC-VB-003-AI NFR-1).
 *
 * Tamper resistance: a quotation's item identity (rfqItemId/name/qty/unit) is
 * ALWAYS seeded from the RFQ. Vendors may only set per-line pricing fields
 * (unitPrice, taxRatePct, discountPct, hsnCode, notes) addressed by rfqItemId.
 * Unknown rfqItemIds in a payload are ignored. Any client-supplied totals are
 * never read.
 */

const PRICING_FIELDS = ["unitPrice", "taxRatePct", "discountPct", "hsnCode", "notes"];

/** Seed quotation line items from the RFQ template (prices empty). */
export function seedItemsFromRfq(rfq) {
  return (rfq.items || []).map((it, idx) => ({
    rfqItemId: String(idx),
    name: it.name,
    qty: it.qty,
    unit: it.unit,
    unitPrice: null,
    taxRatePct: 0,
    discountPct: 0,
    hsnCode: null,
    notes: "",
    lineTotal: 0,
  }));
}

/**
 * Merge incoming per-line pricing into the seeded/existing items. Only pricing
 * fields are honored; identity fields are immutable. Unknown rfqItemIds ignored.
 */
export function mergePricing(items, incomingItems = []) {
  const byId = new Map(items.map((it) => [String(it.rfqItemId), it]));
  for (const incoming of incomingItems) {
    if (!incoming || incoming.rfqItemId == null) continue;
    const target = byId.get(String(incoming.rfqItemId));
    if (!target) continue; // ignore unknown / invented items
    for (const f of PRICING_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(incoming, f)) {
        target[f] = incoming[f];
      }
    }
  }
  return items;
}

/** Sanitize term updates (whitelist; identity/money never here). */
export function mergeTerms(terms = {}, incoming = {}) {
  // terms may be a Mongoose subdocument — spreading it loses schema paths, so
  // normalize to a plain object first.
  const base =
    terms && typeof terms.toObject === "function" ? terms.toObject() : { ...terms };
  const inc =
    incoming && typeof incoming.toObject === "function"
      ? incoming.toObject()
      : incoming || {};
  const out = { ...base };
  const allowed = [
    "paymentDays",
    "deliveryDate",
    "deliveryWindowText",
    "warrantyMonths",
    "minOrderQty",
    "freeText",
  ];
  for (const f of allowed) {
    if (Object.prototype.hasOwnProperty.call(inc, f)) out[f] = inc[f];
  }
  return out;
}

/**
 * Recompute computed{} + per-line lineTotal from the canonical totals service.
 * Mutates and returns the quotation doc.
 */
export function applyComputed(quotation) {
  const plainItems = quotation.items.map((it) => ({
    qty: it.qty,
    unitPrice: it.unitPrice,
    taxRatePct: it.taxRatePct,
    discountPct: it.discountPct,
  }));
  const totals = computeQuotationTotals({
    items: plainItems,
    currency: quotation.currency,
  });
  quotation.items.forEach((it, idx) => {
    it.lineTotal = totals.lineTotals[idx] ?? 0;
  });
  quotation.computed = {
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    discountTotal: totals.discountTotal,
    grandTotal: totals.grandTotal,
    coverage: totals.coverage,
    partial: totals.partial,
  };
  return quotation;
}

/** Load an RFQ that the given vendor is currently assigned to (active). */
export async function loadAssignedActiveRfq({ tenantId, rfqId, vendorId }) {
  if (!mongoose.isValidObjectId(rfqId)) return null;
  return Rfq.findOne({
    _id: rfqId,
    tenantId,
    status: RFQ_STATUS.ACTIVE,
    assignedVendors: vendorId,
  }).lean();
}

/**
 * Load a vendor's OWN quotation by id, scoped to tenant+vendor. Runs inline
 * deadline expiry first so reads reflect state. Returns a hydrated doc (not lean).
 */
export async function loadOwnQuotation({ tenantId, vendorId, id }) {
  if (!mongoose.isValidObjectId(id)) return null;
  await expireOne(id);
  return Quotation.findOne({ _id: id, tenantId, vendorId });
}

/**
 * Create or upsert a DRAFT for {rfqId, vendor}. If an active draft exists it is
 * returned (and optionally re-seeded with new pricing). source/aiSessionId tag
 * the origin. Totals always server-computed.
 */
export async function createOrUpsertDraft({
  tenantId,
  rfq,
  vendorId,
  vendorUserId,
  pricingItems = [],
  terms = {},
  currency,
  source = QUOTATION_SOURCE.MANUAL,
  aiSessionId = null,
  idempotencyKey = null,
}) {
  let quotation = await Quotation.findOne({
    tenantId,
    rfqId: rfq._id,
    vendorId,
    status: { $in: [QUOTATION_STATUS.DRAFT, QUOTATION_STATUS.SUBMITTED] },
  });

  if (quotation && quotation.status === QUOTATION_STATUS.SUBMITTED) {
    const err = new Error("immutable_after_submit");
    err.code = "immutable_after_submit";
    throw err;
  }

  if (!quotation) {
    quotation = new Quotation({
      tenantId,
      rfqId: rfq._id,
      vendorId,
      vendorUserId,
      status: QUOTATION_STATUS.DRAFT,
      currency: currency || QUOTATION_CONFIG.defaultCurrency,
      items: seedItemsFromRfq(rfq),
      terms: {},
      deadline: rfq.deadline,
      rfqVersionNumber: rfq.versionNumber || 1,
      source,
      aiSessionId,
      idempotencyKey,
    });
  } else {
    // keep existing items; re-seed any new RFQ items not present
    const have = new Set(quotation.items.map((i) => String(i.rfqItemId)));
    seedItemsFromRfq(rfq).forEach((seed) => {
      if (!have.has(String(seed.rfqItemId))) quotation.items.push(seed);
    });
    if (source !== QUOTATION_SOURCE.MANUAL) quotation.source = source;
    if (aiSessionId) quotation.aiSessionId = aiSessionId;
  }

  if (currency) quotation.currency = currency;
  mergePricing(quotation.items, pricingItems);
  quotation.terms = mergeTerms(quotation.terms, terms);
  applyComputed(quotation);
  await quotation.save();
  return quotation;
}

export default {
  seedItemsFromRfq,
  mergePricing,
  mergeTerms,
  applyComputed,
  loadAssignedActiveRfq,
  loadOwnQuotation,
  createOrUpsertDraft,
};
