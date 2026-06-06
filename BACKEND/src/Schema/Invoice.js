import mongoose from "mongoose";
import { INVOICE_STATUS } from "../../config/constants.js";

const invoiceLineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    qty: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true, maxlength: 30, default: "" },
    unitPrice: { type: Number, default: 0 }, // paise
    lineTotal: { type: Number, default: 0 }, // paise
  },
  { _id: false }
);

/**
 * Invoice — generated automatically when a quotation is approved.
 * Money is a frozen snapshot (paise) copied from the approved quotation's
 * computed block; it is never recomputed here.
 */
const invoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    number: { type: String, required: true, trim: true },
    rfqId: { type: mongoose.Schema.Types.ObjectId, ref: "Rfq", required: true, index: true },
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      required: true,
      index: true,
    },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "INR" },
    items: { type: [invoiceLineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.ISSUED,
      index: true,
    },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", required: true },
    issuedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true }
);

invoiceSchema.index({ tenantId: 1, number: 1 }, { unique: true });
// one active invoice per quotation (cancelled ones don't block re-issue)
invoiceSchema.index(
  { tenantId: 1, quotationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [INVOICE_STATUS.ISSUED, INVOICE_STATUS.PAID] },
    },
  }
);

const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
export default Invoice;
