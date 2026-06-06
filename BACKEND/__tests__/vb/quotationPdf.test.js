import { describe, it, expect } from "@jest/globals";
import {
  buildQuotationPdfBuffer,
  streamQuotationPdf,
} from "../../src/Services/quotationPdfService.js";

const rfq = { reference: "RFQ-2026-0001", title: "Office Supplies Q3" };
const vendor = { name: "Acme Traders" };

// A submitted quotation with 2 priced items + computed totals.
// All money is integer paise; computed is the single source of truth.
function submittedQuotation() {
  return {
    _id: "quo_submitted_1",
    status: "submitted",
    currency: "INR",
    items: [
      { name: "A4 Paper Ream", qty: 10, unit: "ream", unitPrice: 25000, lineTotal: 250000 },
      { name: "Ballpoint Pen", qty: 50, unit: "pc", unitPrice: 1200, lineTotal: 60000 },
    ],
    terms: {
      paymentDays: 30,
      deliveryDate: new Date("2026-07-15"),
      warrantyMonths: 12,
      freeText: "Delivery to main warehouse dock 3.",
    },
    computed: {
      subtotal: 310000,
      discountTotal: 10000,
      taxTotal: 54000,
      grandTotal: 354000,
      coverage: 1,
      partial: false,
    },
  };
}

function draftQuotation() {
  return {
    _id: "quo_draft_1",
    status: "draft",
    currency: "INR",
    items: [
      { name: "Stapler", qty: 5, unit: "pc", unitPrice: 8000, lineTotal: 40000 },
      // unpriced item — should render em dash, not throw
      { name: "Specialty Toner", qty: 2, unit: "pc", unitPrice: null, lineTotal: 0 },
    ],
    terms: {},
    computed: {
      subtotal: 40000,
      discountTotal: 0,
      taxTotal: 7200,
      grandTotal: 47200,
      coverage: 0.5,
      partial: true,
    },
  };
}

describe("quotationPdfService", () => {
  it("returns a Buffer that begins with the %PDF- magic bytes", async () => {
    const buf = await buildQuotationPdfBuffer(submittedQuotation(), {
      rfq,
      vendor,
      audience: "vendor",
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders a draft quotation (watermark path) without throwing", async () => {
    const buf = await buildQuotationPdfBuffer(draftQuotation(), {
      rfq,
      vendor,
      audience: "staff",
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("renders a 200-item quotation to a Buffer without throwing (length > 1000)", async () => {
    const items = [];
    for (let i = 0; i < 200; i += 1) {
      items.push({
        name: `Item number ${i}`,
        qty: i + 1,
        unit: "pc",
        unitPrice: 100 * (i + 1),
        lineTotal: 100 * (i + 1) * (i + 1),
      });
    }
    const quotation = {
      _id: "quo_big",
      status: "submitted",
      currency: "INR",
      items,
      terms: { paymentDays: 15 },
      computed: {
        subtotal: 9999999,
        discountTotal: 0,
        taxTotal: 1799999,
        grandTotal: 11799998,
        coverage: 1,
        partial: false,
      },
    };
    const buf = await buildQuotationPdfBuffer(quotation, { rfq, vendor, audience: "vendor" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("reads money from computed (grandTotal=123456) without throwing", async () => {
    const quotation = submittedQuotation();
    quotation.computed.grandTotal = 123456; // 1234.56 INR
    const buf = await buildQuotationPdfBuffer(quotation, { rfq, vendor, audience: "vendor" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("streamQuotationPdf sets pdf headers and ends with a buffer", async () => {
    const headers = {};
    let ended = null;
    const res = {
      setHeader: (k, v) => {
        headers[k] = v;
      },
      end: (buf) => {
        ended = buf;
      },
    };
    await streamQuotationPdf(res, submittedQuotation(), { rfq, vendor, audience: "vendor" });
    expect(headers["Content-Type"]).toBe("application/pdf");
    expect(headers["Content-Disposition"]).toContain("attachment");
    expect(headers["Content-Disposition"]).toContain("quotation-RFQ-2026-0001.pdf");
    expect(Buffer.isBuffer(ended)).toBe(true);
    expect(ended.slice(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
