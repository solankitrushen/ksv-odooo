import mongoose from "mongoose";
import {
  QUOTATION_STATUS,
  QUOTATION_SOURCE,
  QUOTATION_APPROVAL_STATUS,
  AI_RECOMMENDATION,
} from "../../config/constants.js";

/**
 * One line of a quotation. unitPrice is stored as integer minor units (paise).
 * taxRatePct / discountPct use Decimal128 for precision; quotationTotalsService
 * converts them to integer math. lineTotal is server-computed, never trusted
 * from the client.
 */
const quotationItemSchema = new mongoose.Schema(
  {
    rfqItemId: { type: String, default: null }, // index into RFQ items (stable id/idx)
    name: { type: String, required: true, trim: true, maxlength: 200 },
    qty: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true, maxlength: 30 },
    // null = item left unpriced (vendor can't / won't supply) → drives coverage
    unitPrice: { type: Number, default: null, min: 0 }, // paise, Int
    taxRatePct: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    discountPct: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    hsnCode: { type: String, trim: true, maxlength: 20, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    // server-computed (paise); persisted for audit + PDF, recomputed on every write
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const quotationTermsSchema = new mongoose.Schema(
  {
    paymentDays: { type: Number, min: 0, max: 365, default: null },
    deliveryDate: { type: Date, default: null },
    deliveryWindowText: { type: String, trim: true, maxlength: 200, default: "" },
    warrantyMonths: { type: Number, min: 0, max: 600, default: null },
    minOrderQty: { type: Number, min: 0, default: null },
    freeText: { type: String, trim: true, maxlength: 2000, default: "" },
  },
  { _id: false }
);

const quotationComputedSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0 }, // paise
    taxTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    coverage: { type: Number, default: 0, min: 0, max: 1 }, // priced/total
    partial: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Staff approval block (SPEC-VB-005). AI auto-review writes aiScore /
 * aiRecommendation / aiFindings; a human admin sets status + decidedBy.
 * Money is never decided here — only the approve/reject workflow state.
 */
const quotationApprovalSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(QUOTATION_APPROVAL_STATUS),
      default: QUOTATION_APPROVAL_STATUS.PENDING,
    },
    aiScore: { type: Number, default: null, min: 0, max: 100 },
    aiRecommendation: {
      type: String,
      enum: [...Object.values(AI_RECOMMENDATION), null],
      default: null,
    },
    aiFindings: { type: [String], default: [] },
    aiReviewedAt: { type: Date, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", default: null },
    decidedAt: { type: Date, default: null },
    reason: { type: String, trim: true, maxlength: 1000, default: null },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rfq",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    vendorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VbUser",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(QUOTATION_STATUS),
      default: QUOTATION_STATUS.DRAFT,
      index: true,
    },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "INR" },
    items: { type: [quotationItemSchema], default: [] },
    terms: { type: quotationTermsSchema, default: () => ({}) },
    computed: { type: quotationComputedSchema, default: () => ({}) },
    approval: { type: quotationApprovalSchema, default: () => ({}) },

    deadline: { type: Date, required: true }, // snapshot of RFQ deadline for atomic submit
    submittedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
    withdrawReason: { type: String, trim: true, maxlength: 500, default: null },

    rfqVersionNumber: { type: Number, default: 1 },
    staleFlag: { type: Boolean, default: false },

    source: {
      type: String,
      enum: Object.values(QUOTATION_SOURCE),
      default: QUOTATION_SOURCE.MANUAL,
    },
    aiSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiQuotationSession",
      default: null,
    },
    idempotencyKey: { type: String, default: null },
    revisionOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      default: null,
    },
  },
  { timestamps: true }
);

// FR-2 / NFR-9: exactly one ACTIVE (draft|submitted) quotation per vendor per RFQ.
// Withdrawn/expired keep history without violating the constraint.
quotationSchema.index(
  { tenantId: 1, rfqId: 1, vendorId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [QUOTATION_STATUS.DRAFT, QUOTATION_STATUS.SUBMITTED] },
    },
  }
);
quotationSchema.index({ tenantId: 1, vendorId: 1, status: 1 });
quotationSchema.index({ tenantId: 1, rfqId: 1, status: 1, submittedAt: -1 });

const Quotation =
  mongoose.models.Quotation || mongoose.model("Quotation", quotationSchema);
export default Quotation;
