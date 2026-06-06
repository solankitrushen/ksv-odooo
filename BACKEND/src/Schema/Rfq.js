import mongoose from "mongoose";
import { RFQ_PRIORITY, RFQ_STATUS } from "../../config/constants.js";

const rfqItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    qty: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true, maxlength: 30 },
  },
  { _id: false }
);

const rfqSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    reference: { type: String, required: true, trim: true },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title too long"],
    },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    requestDate: { type: Date, default: Date.now },
    deadline: { type: Date, required: true },
    items: {
      type: [rfqItemSchema],
      validate: [(arr) => arr.length > 0, "At least one item required"],
    },
    description: { type: String, trim: true, maxlength: 5000, default: "" },
    attachmentUrl: { type: String, trim: true, maxlength: 2000, default: null },
    priority: {
      type: String,
      enum: Object.values(RFQ_PRIORITY),
      default: RFQ_PRIORITY.MEDIUM,
    },
    assignedVendors: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", index: true },
    ],
    status: {
      type: String,
      enum: Object.values(RFQ_STATUS),
      default: RFQ_STATUS.DRAFT,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", required: true },
  },
  { timestamps: true }
);

rfqSchema.index({ tenantId: 1, reference: 1 }, { unique: true });
rfqSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

const Rfq = mongoose.models.Rfq || mongoose.model("Rfq", rfqSchema);
export default Rfq;
