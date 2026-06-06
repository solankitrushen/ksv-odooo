import { z } from "zod";
import { QUOTATION_STATUS } from "../../config/constants.js";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

// Money is integer paise. Floats are rejected (NFR-1/2).
const paise = z.number().int("Price must be whole paise").min(0).max(1_000_000_000_000);
const pct = z.number().min(0).max(100);

// Per-line PRICING ONLY. Identity (name/qty/unit) comes from the RFQ server-side
// and is intentionally NOT accepted here. Unknown rfqItemIds are ignored downstream.
const pricingItem = z.object({
  rfqItemId: z.string().min(1).max(40),
  unitPrice: paise.nullable().optional(),
  taxRatePct: pct.optional(),
  discountPct: pct.optional(),
  hsnCode: z.string().max(20).trim().nullable().optional(),
  notes: z.string().max(500).trim().optional(),
});

const terms = z.object({
  paymentDays: z.number().int().min(0).max(365).nullable().optional(),
  deliveryDate: z.coerce.date().nullable().optional(),
  deliveryWindowText: z.string().max(200).trim().optional(),
  warrantyMonths: z.number().int().min(0).max(600).nullable().optional(),
  minOrderQty: z.number().int().min(0).nullable().optional(),
  freeText: z.string().max(2000).trim().optional(),
});

const currency = z.string().length(3).toUpperCase();

// POST /api/v1/vb/quotations  — create/upsert draft. Any subtotal/grandTotal in
// the body is silently dropped (not in schema → zod strips unknown keys).
export const createQuotationSchema = z.object({
  rfqId: objectId,
  currency: currency.optional(),
  items: z.array(pricingItem).max(500).optional(),
  terms: terms.optional(),
  // accepted only as a reference; server still recomputes everything
  aiSessionId: objectId.optional(),
});

// PATCH /api/v1/vb/quotations/:id
export const patchQuotationSchema = z.object({
  currency: currency.optional(),
  items: z.array(pricingItem).max(500).optional(),
  terms: terms.optional(),
});

export const withdrawQuotationSchema = z.object({
  reason: z.string().min(1).max(500).trim(),
});

export const listQuotationQuerySchema = z.object({
  status: z.nativeEnum(QUOTATION_STATUS).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

// ---- SPEC-VB-003-AI ----
export const aiStartSessionSchema = z.object({
  rfqId: objectId,
});

export const aiAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(60),
        // value is bool | number | string; provider coerces/validates downstream
        value: z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]),
      })
    )
    .min(1)
    .max(2000),
});

export const aiApplySchema = z.object({
  suggestionIds: z.array(z.string().min(1).max(60)).min(1).max(200),
});

export default {
  createQuotationSchema,
  patchQuotationSchema,
  withdrawQuotationSchema,
  listQuotationQuerySchema,
  aiStartSessionSchema,
  aiAnswersSchema,
  aiApplySchema,
};
