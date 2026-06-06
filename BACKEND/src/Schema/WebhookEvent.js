import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ["razorpay"],
      index: true,
    },
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    processedAt: { type: Date, default: null },
    processingError: { type: String, default: null },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstaOrder",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

const WebhookEvent =
  mongoose.models.InstaWebhookEvent ||
  mongoose.model("InstaWebhookEvent", webhookEventSchema);

export default WebhookEvent;
