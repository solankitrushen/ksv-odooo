// Heuristic (deterministic, no-network) quotation AI provider.
//
// Contract (all SYNC here; the LLM provider mirrors these as async):
//   generateQuestions(rfq, ctx)              -> Array<Question>
//   draftFromAnswers(rfq, answers, ctx)      -> Draft (inputs only, never totals)
//   enhance(quotation, rfq, peerStats, ctx)  -> { score, findings, suggestions }
//
// Security/privacy invariants:
//   * Backend is the source of truth for pricing — drafts carry ONLY input
//     fields (unitPrice/tax/discount), never subtotal/grandTotal/total.
//   * enhance() is deterministic and NEVER mutates its inputs.
//   * peer comparisons reference ONLY the aggregate median, never a vendor.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic, stable id for an RFQ line item. */
function rfqItemId(item, i) {
  return item?._id ?? item?.id ?? i;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Integer paise only. Floats that are not integer-ish relax to null. */
function toIntPaise(value) {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  const t = Math.trunc(n);
  return t === n ? t : null;
}

/** Generic integer coercion (truncates) for non-price integer fields. */
function toIntOrNull(value) {
  const n = toFiniteNumber(value);
  return n === null ? null : Math.trunc(n);
}

// ---------------------------------------------------------------------------
// 1) generateQuestions
// ---------------------------------------------------------------------------
export function generateQuestions(rfq, _ctx) {
  const items = Array.isArray(rfq?.items) ? rfq.items : [];
  const questions = [];

  items.forEach((item, i) => {
    const id = rfqItemId(item, i);
    const name = String(item?.name ?? `item ${i}`);

    questions.push({
      id: `supply_${i}`,
      prompt: `Can you supply ${name}?`,
      kind: "bool",
      field: `items.${i}.supply`,
      rfqItemId: id,
      required: true,
    });
    questions.push({
      id: `price_${i}`,
      prompt: `Lowest unit price for ${name} (in paise)?`,
      kind: "money",
      field: `items.${i}.unitPrice`,
      rfqItemId: id,
      min: 0,
      required: true,
    });
    questions.push({
      id: `moq_${i}`,
      prompt: `Minimum order qty for ${name}?`,
      kind: "int",
      field: `items.${i}.minOrderQty`,
      rfqItemId: id,
      min: 0,
      required: false,
    });
  });

  questions.push({
    id: "deliveryLeadDays",
    prompt: "Delivery lead time in days?",
    kind: "int",
    field: "terms.deliveryLeadDays",
    min: 0,
    max: 365,
    required: false,
  });
  questions.push({
    id: "paymentDays",
    prompt: "Payment terms — net days?",
    kind: "int",
    field: "terms.paymentDays",
    min: 0,
    max: 365,
    required: false,
  });
  questions.push({
    id: "warrantyMonths",
    prompt: "Warranty period in months?",
    kind: "int",
    field: "terms.warrantyMonths",
    min: 0,
    max: 600,
    required: false,
  });
  questions.push({
    id: "currency",
    prompt: "Quotation currency?",
    kind: "enum",
    field: "terms.currency",
    options: ["INR", "USD", "EUR"],
    required: false,
  });
  questions.push({
    id: "caveats",
    prompt: "Any caveats or notes?",
    kind: "text",
    field: "terms.freeText",
    required: false,
  });

  return questions;
}

// ---------------------------------------------------------------------------
// 2) draftFromAnswers
// ---------------------------------------------------------------------------
export function draftFromAnswers(rfq, answers, ctx) {
  const items = Array.isArray(rfq?.items) ? rfq.items : [];
  const answerList = Array.isArray(answers) ? answers : [];

  // Map answers onto question fields (matching by question.field).
  const questions = generateQuestions(rfq, ctx);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const valueByField = {};
  for (const a of answerList) {
    const q = byId.get(a?.questionId);
    if (q) valueByField[q.field] = a.value;
  }

  let firstMoq = null;
  const draftItems = items.map((item, i) => {
    const supply = valueByField[`items.${i}.supply`];
    const rawPrice = valueByField[`items.${i}.unitPrice`];
    const moq = toIntOrNull(valueByField[`items.${i}.minOrderQty`]);
    if (firstMoq === null && moq !== null) firstMoq = moq;

    const supplied = supply !== false; // undefined => assume supplied
    const hasPrice = rawPrice !== null && rawPrice !== undefined && rawPrice !== "";
    const unitPrice = supplied && hasPrice ? toIntPaise(rawPrice) : null;

    return {
      rfqItemId: rfqItemId(item, i),
      name: String(item?.name ?? `item ${i}`),
      qty: item?.qty ?? null,
      unit: item?.unit ?? null,
      unitPrice,
      taxRatePct: 0,
      discountPct: 0,
    };
  });

  const leadDays = toIntOrNull(valueByField["terms.deliveryLeadDays"]);
  const deliveryDate =
    leadDays !== null
      ? new Date(Date.now() + leadDays * DAY_MS).toISOString()
      : null;

  const allowedCurrencies = ["INR", "USD", "EUR"];
  const rawCurrency = valueByField["terms.currency"];
  const currency = allowedCurrencies.includes(rawCurrency)
    ? rawCurrency
    : "INR";

  return {
    items: draftItems,
    terms: {
      paymentDays: toIntOrNull(valueByField["terms.paymentDays"]),
      deliveryDate,
      warrantyMonths: toIntOrNull(valueByField["terms.warrantyMonths"]),
      minOrderQty: firstMoq,
      freeText:
        valueByField["terms.freeText"] != null
          ? String(valueByField["terms.freeText"])
          : "",
    },
    currency,
  };
}

// ---------------------------------------------------------------------------
// 3) enhance
// ---------------------------------------------------------------------------
export function enhance(quotation, rfq, peerStats, _ctx) {
  const items = Array.isArray(quotation?.items) ? quotation.items : [];
  const terms = quotation?.terms ?? {};
  const findings = [];
  const suggestions = [];
  let score = 100;

  // a) Unpriced items (high) — capped total deduction.
  let unpricedCount = 0;
  items.forEach((item, i) => {
    if (item?.unitPrice === null || item?.unitPrice === undefined) {
      unpricedCount += 1;
      const name = String(item?.name ?? `item ${i}`);
      findings.push(`Item "${name}" has no unit price.`);
      suggestions.push({
        id: `unpriced_item_${i}`,
        type: "unpriced_item",
        field: `items.${i}.unitPrice`,
        rfqItemId: item?.rfqItemId ?? i,
        current: null,
        proposed: null,
        rationale: `Provide a unit price for "${name}" so the quotation covers all requested items.`,
        severity: "high",
      });
    }
  });
  score -= Math.min(unpricedCount * 15, 45);

  // b) Late delivery (warn).
  const deadline = rfq?.deadline ? Date.parse(rfq.deadline) : NaN;
  const deliveryDate = terms?.deliveryDate ? Date.parse(terms.deliveryDate) : NaN;
  if (
    Number.isFinite(deadline) &&
    Number.isFinite(deliveryDate) &&
    deliveryDate > deadline
  ) {
    findings.push("Delivery date is past the RFQ deadline.");
    suggestions.push({
      id: "late_delivery",
      type: "late_delivery",
      field: "terms.deliveryDate",
      current: terms.deliveryDate,
      proposed: rfq.deadline,
      rationale: "Bring the delivery date on or before the RFQ deadline.",
      severity: "warn",
    });
    score -= 10;
  }

  // c) Missing payment terms (info).
  if (terms?.paymentDays === null || terms?.paymentDays === undefined) {
    findings.push("Payment terms (paymentDays) are missing.");
    suggestions.push({
      id: "missing_terms",
      type: "missing_terms",
      field: "terms.paymentDays",
      current: null,
      proposed: null,
      rationale: "Specify net payment days so buyers can compare terms.",
      severity: "info",
    });
    score -= 5;
  }

  // d) Price vs aggregate peer median (warn). Never references any vendor.
  if (peerStats) {
    items.forEach((item, i) => {
      const id = item?.rfqItemId ?? i;
      const ps = peerStats?.[id] ?? peerStats?.[i];
      const median = ps ? toFiniteNumber(ps.median) : null;
      const price = toFiniteNumber(item?.unitPrice);
      if (median !== null && median > 0 && price !== null && price > 1.25 * median) {
        const name = String(item?.name ?? `item ${i}`);
        findings.push(
          `Unit price for "${name}" exceeds the peer median by more than 25%.`,
        );
        suggestions.push({
          id: `price_vs_peer_${i}`,
          type: "price_vs_peer",
          field: `items.${i}.unitPrice`,
          rfqItemId: id,
          current: price,
          proposed: median,
          rationale: `Your unit price (${price} paise) is above the aggregate peer median (${median} paise). Consider aligning closer to the median.`,
          severity: "warn",
        });
        score -= 8;
      }
    });
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return { score, findings, suggestions };
}
