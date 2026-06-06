import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstaOrder",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["upi", "card", "wallet", "cash"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    transactionId: String,
  },
  { timestamps: true }
);

const Payment =
  mongoose.models.InstaPayment ||
  mongoose.model("InstaPayment", paymentSchema);
export default Payment;
