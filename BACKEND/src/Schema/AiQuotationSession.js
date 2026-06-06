import mongoose from "mongoose";
import {
  AI_SESSION_MODE,
  AI_SESSION_STATUS,
  AI_QUESTION_KIND_VALUES,
} from "../../config/constants.js";

const aiQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    prompt: { type: String, required: true },
    kind: { type: String, enum: AI_QUESTION_KIND_VALUES, required: true },
    field: { type: String, required: true }, // dot-path the answer maps to
    rfqItemId: { type: String, default: null },
    options: { type: [String], default: undefined }, // for enum
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const aiAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiSuggestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true }, // unpriced_item | late_delivery | price_vs_peer | missing_terms ...
    field: { type: String, default: null },
    rfqItemId: { type: String, default: null },
    current: { type: mongoose.Schema.Types.Mixed, default: null },
    proposed: { type: mongoose.Schema.Types.Mixed, default: null },
    rationale: { type: String, default: "" },
    severity: { type: String, enum: ["info", "warn", "high"], default: "info" },
  },
  { _id: false }
);

/**
 * AI co-pilot scratchpad. NOT a money record — the real draft lives in
 * Quotation. TTL-expired. Scoped per {tenantId, rfqId, vendorUserId} so two
 * vendors never share questions/answers/drafts.
 */
const aiQuotationSessionSchema = new mongoose.Schema(
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
    },
    vendorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VbUser",
      required: true,
    },
    mode: {
      type: String,
      enum: Object.values(AI_SESSION_MODE),
      default: AI_SESSION_MODE.GENERATE,
    },
    status: {
      type: String,
      enum: Object.values(AI_SESSION_STATUS),
      default: AI_SESSION_STATUS.OPEN,
    },
    provider: { type: String, default: "heuristic" },
    questions: { type: [aiQuestionSchema], default: [] },
    answers: { type: [aiAnswerSchema], default: [] },
    draftQuotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      default: null,
    },
    lastScore: { type: Number, default: null, min: 0, max: 100 },
    suggestions: { type: [aiSuggestionSchema], default: [] },
    findings: { type: [String], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

aiQuotationSessionSchema.index({ tenantId: 1, rfqId: 1, vendorUserId: 1, mode: 1 });
aiQuotationSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AiQuotationSession =
  mongoose.models.AiQuotationSession ||
  mongoose.model("AiQuotationSession", aiQuotationSessionSchema);
export default AiQuotationSession;
