import { describe, expect, it } from "@jest/globals";

import * as heuristic from "../../src/Integrations/quotationAi/heuristicProvider.js";
import { getQuotationAiProvider } from "../../src/Integrations/quotationAi/index.js";

// Fixed, DB-free RFQ fixture.
const rfq = {
  deadline: "2026-06-01T00:00:00.000Z",
  items: [
    { name: "Chair", qty: 10, unit: "pcs" },
    { name: "Desk", qty: 5, unit: "pcs" },
  ],
};

/** Recursively assert an object tree contains no total-like keys. */
function assertNoTotals(node) {
  if (Array.isArray(node)) {
    node.forEach(assertNoTotals);
    return;
  }
  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      expect(["total", "subtotal", "grandTotal", "grandtotal"]).not.toContain(
        key.toLowerCase(),
      );
      assertNoTotals(node[key]);
    }
  }
}

describe("quotationAi heuristic provider", () => {
  it("(a) generateQuestions is deterministic and has per-item + global questions", () => {
    const q1 = heuristic.generateQuestions(rfq);
    const q2 = heuristic.generateQuestions(rfq);
    expect(q1).toEqual(q2); // deterministic

    const ids = q1.map((q) => q.id);
    // per-item supply/price/moq for both items
    expect(ids).toEqual(
      expect.arrayContaining([
        "supply_0",
        "price_0",
        "moq_0",
        "supply_1",
        "price_1",
        "moq_1",
      ]),
    );
    // global currency + payment
    expect(ids).toEqual(expect.arrayContaining(["currency", "paymentDays"]));

    const currency = q1.find((q) => q.id === "currency");
    expect(currency.kind).toBe("enum");
    expect(currency.options).toEqual(["INR", "USD", "EUR"]);

    const price0 = q1.find((q) => q.id === "price_0");
    expect(price0).toMatchObject({
      kind: "money",
      field: "items.0.unitPrice",
      min: 0,
    });
  });

  it("(b) draftFromAnswers maps prices, leaves unsupplied item unpriced, no totals", () => {
    const answers = [
      { questionId: "supply_0", value: true },
      { questionId: "price_0", value: 12000 },
      { questionId: "moq_0", value: 5 },
      { questionId: "supply_1", value: false }, // not supplied
      { questionId: "price_1", value: 9999 }, // ignored because unsupplied
      { questionId: "paymentDays", value: 30 },
      { questionId: "currency", value: "INR" },
    ];

    const draft = heuristic.draftFromAnswers(rfq, answers);

    expect(draft.items[0].unitPrice).toBe(12000);
    expect(draft.items[1].unitPrice).toBeNull(); // unsupplied -> unpriced
    expect(draft.terms.paymentDays).toBe(30);
    expect(draft.currency).toBe("INR");

    assertNoTotals(draft); // no total/subtotal/grandTotal anywhere
  });

  it("(c) draftFromAnswers with a float price yields null or integer, never a float", () => {
    const answers = [
      { questionId: "supply_0", value: true },
      { questionId: "price_0", value: 100.5 }, // float
    ];
    const draft = heuristic.draftFromAnswers(rfq, answers);
    const p = draft.items[0].unitPrice;
    const ok = p === null || Number.isInteger(p);
    expect(ok).toBe(true);
  });

  it("(d) enhance flags unpriced/late/missing terms + peer median, score 0-100, no vendor identity", () => {
    const quotation = {
      items: [
        {
          rfqItemId: 0,
          name: "Chair",
          qty: 10,
          unit: "pcs",
          unitPrice: 20000,
          taxRatePct: 0,
          discountPct: 0,
        },
        {
          rfqItemId: 1,
          name: "Desk",
          qty: 5,
          unit: "pcs",
          unitPrice: null, // unpriced
          taxRatePct: 0,
          discountPct: 0,
        },
      ],
      terms: {
        deliveryDate: "2026-07-01T00:00:00.000Z", // past deadline
        // paymentDays intentionally missing
      },
      currency: "INR",
    };
    const peerStats = { 0: { median: 10000 } }; // 20000 > 1.25 * 10000

    const frozenQuote = JSON.parse(JSON.stringify(quotation));
    const result = heuristic.enhance(quotation, rfq, peerStats);

    const types = result.suggestions.map((s) => s.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "unpriced_item",
        "late_delivery",
        "missing_terms",
        "price_vs_peer",
      ]),
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);

    const peer = result.suggestions.find((s) => s.type === "price_vs_peer");
    expect(peer.proposed).toBe(10000); // aggregate median
    expect(peer.rationale).toMatch(/median/i);
    // rationale must NOT leak any vendor identity
    expect(peer.rationale.toLowerCase()).not.toMatch(/vendor|seller|supplier|by\s/);

    // inputs are never mutated
    expect(quotation).toEqual(frozenQuote);
  });

  it("(e) getQuotationAiProvider defaults to heuristic and falls back when llm unconfigured", () => {
    const saved = {
      provider: process.env.QUOTATION_AI_PROVIDER,
      baseUrl: process.env.QUOTATION_AI_LLM_BASE_URL,
      apiKey: process.env.QUOTATION_AI_LLM_API_KEY,
    };
    try {
      delete process.env.QUOTATION_AI_PROVIDER;
      delete process.env.QUOTATION_AI_LLM_BASE_URL;
      delete process.env.QUOTATION_AI_LLM_API_KEY;

      // default -> heuristic
      expect(getQuotationAiProvider().generateQuestions).toBe(
        heuristic.generateQuestions,
      );

      // llm selected but unconfigured -> graceful fallback to heuristic
      process.env.QUOTATION_AI_PROVIDER = "llm";
      expect(getQuotationAiProvider().generateQuestions).toBe(
        heuristic.generateQuestions,
      );
    } finally {
      if (saved.provider === undefined) delete process.env.QUOTATION_AI_PROVIDER;
      else process.env.QUOTATION_AI_PROVIDER = saved.provider;
      if (saved.baseUrl === undefined) delete process.env.QUOTATION_AI_LLM_BASE_URL;
      else process.env.QUOTATION_AI_LLM_BASE_URL = saved.baseUrl;
      if (saved.apiKey === undefined) delete process.env.QUOTATION_AI_LLM_API_KEY;
      else process.env.QUOTATION_AI_LLM_API_KEY = saved.apiKey;
    }
  });
});
