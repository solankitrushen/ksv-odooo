import mongoose from "mongoose";

const refundTicketSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstaOrder",
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstaUser",
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstaStore",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "processing", "processed", "failed", "manual"],
      default: "pending",
    },
    provider: {
      type: String,
      enum: ["razorpay", "test", null],
      default: null,
    },
    providerRefundId: { type: String, default: null },
    providerError: { type: String, maxlength: 1000, default: null },
    supportPhone: { type: String, default: null },
    notes: { type: String, maxlength: 1000, default: "" },
  },
  { timestamps: true }
);

refundTicketSchema.index({ userId: 1, createdAt: -1 });
refundTicketSchema.index({ storeId: 1, createdAt: -1 });

const RefundTicket =
  mongoose.models.RefundTicket || mongoose.model("RefundTicket", refundTicketSchema);

export default RefundTicket;
