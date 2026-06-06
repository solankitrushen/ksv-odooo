import mongoose from "mongoose";

const PO_STATUS = {
  ISSUED: "issued",
  ACKNOWLEDGED: "acknowledged",
  FULFILLED: "fulfilled",
  CANCELLED: "cancelled",
};

const poLineSchema = new mongoose.Schema(
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
 * PurchaseOrder — created automatically when a quotation is approved. Money is
 * a frozen paise snapshot of the approved quotation; never recomputed here.
 * The invoice is generated FROM the PO (spec workflow step 5→6).
 */
const purchaseOrderSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    number: { type: String, required: true, trim: true }, // PO-YYYY-NNNN
    rfqId: { type: mongoose.Schema.Types.ObjectId, ref: "Rfq", required: true, index: true },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "INR" },
    items: { type: [poLineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(PO_STATUS), default: PO_STATUS.ISSUED, index: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", required: true },
    issuedAt: { type: Date, default: Date.now },
    expectedDelivery: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ tenantId: 1, number: 1 }, { unique: true });
purchaseOrderSchema.index(
  { tenantId: 1, quotationId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: PO_STATUS.CANCELLED } },
  }
);

export { PO_STATUS };
const PurchaseOrder =
  mongoose.models.PurchaseOrder || mongoose.model("PurchaseOrder", purchaseOrderSchema);
export default PurchaseOrder;
