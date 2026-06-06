import { describe, expect, it } from "@jest/globals";
import computeQuotationTotals, {
  computeQuotationTotals as namedCompute,
  recomputeItemsWithLineTotals,
} from "../../src/Services/quotationTotalsService.js";

describe("quotationTotalsService.computeQuotationTotals (pure money calculator)", () => {
  it("default export and named export are the same function", () => {
    expect(computeQuotationTotals).toBe(namedCompute);
  });

  it("(1) basic single priced item", () => {
    // Arrange
    const input = {
      items: [{ qty: 2, unitPrice: 5000, taxRatePct: 0, discountPct: 0 }],
    };

    // Act
    const result = computeQuotationTotals(input);

    // Assert
    expect(result.subtotal).toBe(10000);
    expect(result.discountTotal).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(result.grandTotal).toBe(10000);
    expect(result.lineTotals).toEqual([10000]);
    expect(result.coverage).toBe(1);
    expect(result.partial).toBe(false);
    expect(result.currency).toBe("INR");
  });

  it("(2) discount + tax rounding correctness with exact expected paise", () => {
    // qty=3, unitPrice=999 → subtotal 2997
    // discount 10% → round(299.7) = 300
    // tax 18% of (2997-300=2697) → round(485.46) = 485
    // total = 2997 - 300 + 485 = 3182
    const input = {
      items: [{ qty: 3, unitPrice: 999, discountPct: 10, taxRatePct: 18 }],
    };

    const result = computeQuotationTotals(input);

    expect(result.subtotal).toBe(2997);
    expect(result.discountTotal).toBe(300);
    expect(result.taxTotal).toBe(485);
    expect(result.grandTotal).toBe(3182);
    expect(result.lineTotals).toEqual([3182]);
  });

  it("(3) unpriced items are excluded; coverage computed (3 of 5 → 0.6, partial)", () => {
    const input = {
      items: [
        { qty: 1, unitPrice: 1000, taxRatePct: 0, discountPct: 0 },
        { qty: 2, unitPrice: null, taxRatePct: 18, discountPct: 0 }, // unpriced
        { qty: 4, unitPrice: 250, taxRatePct: 0, discountPct: 0 },
        { qty: 1, unitPrice: undefined, taxRatePct: 5, discountPct: 0 }, // unpriced
        { qty: 5, unitPrice: 100, taxRatePct: 0, discountPct: 0 },
      ],
    };

    const result = computeQuotationTotals(input);

    // priced subtotal = 1000 + 1000 + 500 = 2500
    expect(result.subtotal).toBe(2500);
    expect(result.grandTotal).toBe(2500);
    // unpriced lines contribute 0 in input order
    expect(result.lineTotals).toEqual([1000, 0, 1000, 0, 500]);
    expect(result.coverage).toBe(0.6);
    expect(result.partial).toBe(true);
  });

  it("(4) discountPct = 100 → lineTotal 0 (with no tax)", () => {
    const input = {
      items: [{ qty: 7, unitPrice: 4321, discountPct: 100, taxRatePct: 18 }],
    };

    const result = computeQuotationTotals(input);

    // subtotal = 30247, discount = 30247, taxable base = 0 → tax 0
    expect(result.subtotal).toBe(30247);
    expect(result.discountTotal).toBe(30247);
    expect(result.taxTotal).toBe(0);
    expect(result.grandTotal).toBe(0);
    expect(result.lineTotals).toEqual([0]);
  });

  it("(5) accepts Decimal128-like objects via valueOf()", () => {
    const input = {
      items: [
        {
          qty: 2,
          unitPrice: 1000,
          taxRatePct: { valueOf: () => "18" },
          discountPct: { valueOf: () => "0" },
        },
      ],
    };

    const result = computeQuotationTotals(input);

    // subtotal 2000, tax 18% = 360, total 2360
    expect(result.subtotal).toBe(2000);
    expect(result.taxTotal).toBe(360);
    expect(result.grandTotal).toBe(2360);
    expect(result.lineTotals).toEqual([2360]);
  });

  it("coerces malformed numeric pct to 0 instead of throwing", () => {
    const input = {
      items: [
        {
          qty: 1,
          unitPrice: 1000,
          taxRatePct: "not-a-number",
          discountPct: undefined,
        },
      ],
    };

    const result = computeQuotationTotals(input);

    expect(result.taxTotal).toBe(0);
    expect(result.discountTotal).toBe(0);
    expect(result.grandTotal).toBe(1000);
  });

  it("empty / missing items → coverage 0, partial true, no totals", () => {
    expect(computeQuotationTotals({ items: [] })).toMatchObject({
      subtotal: 0,
      grandTotal: 0,
      coverage: 0,
      partial: true,
      lineTotals: [],
    });
    expect(computeQuotationTotals({})).toMatchObject({
      coverage: 0,
      partial: true,
      lineTotals: [],
    });
    expect(computeQuotationTotals(undefined)).toMatchObject({
      coverage: 0,
      lineTotals: [],
    });
  });

  describe("recomputeItemsWithLineTotals", () => {
    it("merges a numeric lineTotal into each item without mutating input", () => {
      const items = [
        { qty: 2, unitPrice: 1000, discountPct: 0, taxRatePct: 0 },
        { qty: 1, unitPrice: null, discountPct: 0, taxRatePct: 18 },
      ];
      const out = recomputeItemsWithLineTotals(items);

      expect(out[0].lineTotal).toBe(2000);
      expect(out[1].lineTotal).toBe(0);
      // original untouched
      expect(items[0]).not.toHaveProperty("lineTotal");
      expect(out[0]).not.toBe(items[0]);
    });

    it("handles non-array input gracefully", () => {
      expect(recomputeItemsWithLineTotals(undefined)).toEqual([]);
      expect(recomputeItemsWithLineTotals(null)).toEqual([]);
    });
  });
});

describe("quotationTotalsService — property / fuzz (1000 random quotations)", () => {
  // Deterministic PRNG (mulberry32) so the fuzz run itself is reproducible.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomQuotation(rand) {
    const itemCount = 1 + Math.floor(rand() * 8); // 1..8 items
    const items = [];
    for (let i = 0; i < itemCount; i += 1) {
      const qty = 1 + Math.floor(rand() * 100); // 1..100
      const unpriced = rand() < 0.2;
      const unitPrice = unpriced ? null : Math.floor(rand() * 1000000); // 0..999999 paise
      const taxRatePct = Math.floor(rand() * 29); // 0..28
      const discountPct = Math.floor(rand() * 101); // 0..100
      items.push({ qty, unitPrice, taxRatePct, discountPct });
    }
    return { items, currency: "INR" };
  }

  it("grandTotal equals sum of recomputed lineTotals; integers; no NaN; deterministic", () => {
    const rand = mulberry32(123456789);

    for (let n = 0; n < 1000; n += 1) {
      const quotation = randomQuotation(rand);

      const a = computeQuotationTotals(quotation);
      const b = computeQuotationTotals(quotation);

      // Deterministic: identical output on repeat compute.
      expect(b).toEqual(a);

      // All aggregate values are finite integers.
      for (const key of ["subtotal", "taxTotal", "discountTotal", "grandTotal"]) {
        expect(Number.isInteger(a[key])).toBe(true);
        expect(Number.isNaN(a[key])).toBe(false);
      }

      // Every per-line total is a finite integer, no NaN.
      for (const lt of a.lineTotals) {
        expect(Number.isInteger(lt)).toBe(true);
        expect(Number.isNaN(lt)).toBe(false);
      }

      // grandTotal === sum of recomputed lineTotals.
      const recomputed = recomputeItemsWithLineTotals(quotation.items);
      const sumLineTotals = recomputed.reduce((acc, it) => acc + it.lineTotal, 0);
      expect(a.grandTotal).toBe(sumLineTotals);

      // lineTotals array matches recomputed per-line totals in order.
      expect(a.lineTotals).toEqual(recomputed.map((it) => it.lineTotal));

      // coverage is in [0,1], rounded to <=4 decimals; partial mirrors coverage<1.
      expect(a.coverage).toBeGreaterThanOrEqual(0);
      expect(a.coverage).toBeLessThanOrEqual(1);
      expect(a.partial).toBe(a.coverage < 1);
    }
  });
});
