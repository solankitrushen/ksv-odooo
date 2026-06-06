/**
 * quotationTotalsService — PURE, deterministic money calculator.
 *
 * No DB access, no Schema imports, no side effects. Given a set of quotation
 * line items (with money expressed as integer paise), it computes per-line and
 * aggregate totals. Upstream Zod validators are responsible for rejecting bad
 * input (negative qty/price, etc.); this module performs only defensive numeric
 * coercion so it never throws on malformed numeric fields.
 *
 * Money convention: all monetary values are integer paise. Percentages
 * (taxRatePct, discountPct) may be number | string | Decimal128-like (anything
 * exposing valueOf()).
 */

/**
 * Coerce a percentage-like value (number | string | Decimal128-like) to a finite
 * Number. Defaults to 0; NaN/Infinity collapse to 0.
 * @param {number|string|{valueOf:Function}|null|undefined} value
 * @returns {number}
 */
function coercePct(value) {
  if (value === null || value === undefined) return 0;
  const raw = value && typeof value.valueOf === "function" ? value.valueOf() : value;
  const num = Number(String(raw));
  return Number.isFinite(num) ? num : 0;
}

/**
 * Coerce a quantity to a finite integer-ish Number. Defaults to 0 when invalid.
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
function coerceQty(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Compute the per-line money breakdown for a single item.
 * Unpriced items (unitPrice == null) contribute nothing and are not "priced".
 * @param {object} item
 * @returns {{priced:boolean, lineSubtotal:number, lineDiscount:number, lineTax:number, lineTotal:number}}
 */
function computeLine(item) {
  const i = item || {};

  // null OR undefined unitPrice → unpriced line.
  if (i.unitPrice === null || i.unitPrice === undefined) {
    return {
      priced: false,
      lineSubtotal: 0,
      lineDiscount: 0,
      lineTax: 0,
      lineTotal: 0,
    };
  }

  const qty = coerceQty(i.qty);
  const unitPrice = coerceQty(i.unitPrice);
  const discountPct = coercePct(i.discountPct);
  const taxRatePct = coercePct(i.taxRatePct);

  const lineSubtotal = qty * unitPrice;
  const lineDiscount = Math.round((lineSubtotal * discountPct) / 100);
  const lineTax = Math.round(((lineSubtotal - lineDiscount) * taxRatePct) / 100);
  const lineTotal = lineSubtotal - lineDiscount + lineTax;

  return { priced: true, lineSubtotal, lineDiscount, lineTax, lineTotal };
}

/**
 * Round a ratio to 4 decimal places.
 * @param {number} value
 * @returns {number}
 */
function round4(value) {
  return Math.round(value * 10000) / 10000;
}

/**
 * Compute deterministic totals for a quotation.
 *
 * @param {{items?: Array<object>, currency?: string}} input
 * @returns {{
 *   subtotal:number,
 *   taxTotal:number,
 *   discountTotal:number,
 *   grandTotal:number,
 *   coverage:number,
 *   partial:boolean,
 *   lineTotals:number[],
 *   currency:string
 * }}
 */
export function computeQuotationTotals(input) {
  const src = input || {};
  const items = Array.isArray(src.items) ? src.items : [];
  const currency = typeof src.currency === "string" && src.currency ? src.currency : "INR";

  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;
  let pricedCount = 0;

  const lineTotals = new Array(items.length);

  for (let idx = 0; idx < items.length; idx += 1) {
    const line = computeLine(items[idx]);
    lineTotals[idx] = line.lineTotal;
    if (line.priced) {
      pricedCount += 1;
      subtotal += line.lineSubtotal;
      discountTotal += line.lineDiscount;
      taxTotal += line.lineTax;
      grandTotal += line.lineTotal;
    }
  }

  const totalItems = items.length;
  const coverage = totalItems === 0 ? 0 : round4(pricedCount / totalItems);
  const partial = coverage < 1;

  return {
    subtotal,
    taxTotal,
    discountTotal,
    grandTotal,
    coverage,
    partial,
    lineTotals,
    currency,
  };
}

/**
 * Return a shallow copy of each item with a numeric `lineTotal` field merged in.
 * Unpriced items get lineTotal 0. Does not mutate the input items.
 *
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
export function recomputeItemsWithLineTotals(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map((item) => {
    const line = computeLine(item);
    return { ...(item || {}), lineTotal: line.lineTotal };
  });
}

export default computeQuotationTotals;
