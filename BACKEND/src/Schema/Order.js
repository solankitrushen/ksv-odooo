import mongoose from "mongoose";
import {
  ORDER_STATUS,
  DELIVERY_TYPES,
  PAYMENT_STATUS,
  STORE_MESSAGE_TYPES,
} from "../../config/constants.js";
import { emitOrderUpdate } from "../Utils/orderEvents.js";

const orderLineSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "InstaMenuItem" },
    comboId: { type: mongoose.Schema.Types.ObjectId, ref: "InstaCombo" },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    byRole: { type: String, enum: ["user", "store", "admin", "system"] },
    byId: mongoose.Schema.Types.ObjectId,
    note: String,
  },
  { _id: false }
);

const storeMessageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: STORE_MESSAGE_TYPES,
      default: "general",
    },
    message: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
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
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    deliveryType: {
      type: String,
      enum: DELIVERY_TYPES,
      required: true,
    },
    deliveryDistanceKm: { type: Number, min: 0, default: 0 },
    deliveryLatitude: { type: Number, min: -90, max: 90, default: null },
    deliveryLongitude: { type: Number, min: -180, max: 180, default: null },
    deliveryCharge: { type: Number, min: 0, default: 0 },
    deliveryOtpHash: { type: String, default: null, select: false },
    deliveryOtp: { type: String, default: null, select: false },
    deliveryProofImageUrl: { type: String, default: null },
    subtotal: { type: Number, required: true, min: 0 },
    // Customer-paid platform fee, computed from the store's
    // razorpay.commissionPercent at quote time. Stored so historical
    // orders keep the fee that the customer actually saw.
    platformFee: { type: Number, min: 0, default: 0 },
    platformFeePercent: { type: Number, min: 0, max: 100, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    items: { type: [orderLineSchema], required: true },
    userNote: { type: String, maxlength: 500, default: "" },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    paymentProvider: {
      type: String,
      enum: ["razorpay", "test"],
      default: null,
    },
    paymentReference: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },
    paymentVerifiedAt: { type: Date, default: null },
    payout: {
      merchantAmount: { type: Number, default: null },
      platformAmount: { type: Number, default: null },
      transferId: { type: String, default: null },
      transferStatus: {
        type: String,
        enum: ["pending", "processed", "failed", "reversed", "settled"],
        default: "pending",
      },
      transferUpdatedAt: { type: Date, default: null },
      linkedAccountId: { type: String, default: null },
      commissionPercent: { type: Number, default: null },
    },
    version: { type: Number, default: 0 },
    // Set when the store accepts; drives the customer-facing ETA countdown.
    acceptedAt: { type: Date, default: null },
    preparationMinutes: { type: Number, min: 1, max: 240, default: null },
    rejectReason: { type: String, maxlength: 500, default: null },
    prepNotes: { type: String, maxlength: 1000, default: "" },
    storeMessages: [storeMessageSchema],
    statusHistory: [statusEventSchema],
    failureReview: {
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      reviewedAt: { type: Date, default: null },
      notes: { type: String, maxlength: 1000, default: "" },
    },
  },
  { timestamps: true }
);

orderSchema.index({ storeId: 1, status: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1, status: 1 });
orderSchema.index({ storeId: 1, paymentStatus: 1, createdAt: -1 });

// Cap storeMessages array growth at 50 to prevent flood by a misconfigured
// store. Only enforced by Mongoose document writes; updates can $slice.
orderSchema.path("storeMessages").validators.push({
  validator(arr) {
    return !arr || arr.length <= 50;
  },
  message: "Too many store messages",
});

// Single chokepoint: any persisted order change is pushed to subscribers
// (store SSE stream). Covers create/save and atomic findOneAndUpdate writes.
orderSchema.post("save", (doc) => emitOrderUpdate(doc));
orderSchema.post("findOneAndUpdate", (doc) => doc && emitOrderUpdate(doc));

const Order =
  mongoose.models.InstaOrder || mongoose.model("InstaOrder", orderSchema);

export default Order;
