import mongoose from "mongoose";

/**
 * Immutable snapshot of a quotation at the moment of resubmit (FR-10 core).
 * Stores the prior submitted quotation's payload so audit + comparison can
 * show the revision history without mutating the live Quotation.
 */
const quotationRevisionSchema = new mongoose.Schema(
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
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      required: true,
      index: true,
    },
    revisionNumber: { type: Number, required: true, default: 1 },
    // frozen copy of the quotation document at snapshot time
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VbUser",
      required: true,
    },
  },
  { timestamps: true }
);

quotationRevisionSchema.index({ tenantId: 1, quotationId: 1, revisionNumber: -1 });

const QuotationRevision =
  mongoose.models.QuotationRevision ||
  mongoose.model("QuotationRevision", quotationRevisionSchema);
export default QuotationRevision;
