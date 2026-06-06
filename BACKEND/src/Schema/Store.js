import mongoose from "mongoose";
import { hashPasswordHook, comparePasswordMethod } from "./shared/passwordHooks.js";

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Store name required"],
      trim: true,
      maxlength: [100, "Name too long"],
    },
    phone: {
      type: String,
      required: [true, "Phone required"],
      match: [/^[0-9]{10}$/, "Invalid phone"],
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email required"],
      match: [/^[\w.-]+@[\w.-]+\.\w+$/, "Invalid email"],
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Password required"],
      minlength: [8, "Min 8 chars"],
      select: false,
    },
    role: {
      type: String,
      enum: ["store"],
      default: "store",
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      zipCode: String,
      building: String,
      block: String,
      shopNumber: String,
      landmark: String,
    },
    owner: {
      name: { type: String, trim: true, maxlength: 100 },
      phone: { type: String, match: [/^[0-9]{10}$/, "Invalid owner phone"] },
    },
    location: {
      latitude: { type: Number, min: -90, max: 90, default: null },
      longitude: { type: Number, min: -180, max: 180, default: null },
    },
    cuisineTypes: [
      {
        type: String,
        enum: [
          "north-indian",
          "south-indian",
          "chinese",
          "continental",
          "desserts",
          "beverages",
        ],
      },
    ],
    upiId: String,
    // Per-store ordering rules. Defaults mirror config/constants.js ORDERING_DEFAULTS.
    ordering: {
      minOrderValue: { type: Number, min: 0, default: 200 },
      freeDeliveryThreshold: { type: Number, min: 0, default: 399 },
      deliveryFee: { type: Number, min: 0, default: 40 },
      freeRadiusKm: { type: Number, min: 0, default: 1 },
      maxRadiusKm: { type: Number, min: 0, default: 1 },
      perKmFee: { type: Number, min: 0, default: 15 },
    },
    qrCode: {
      data: String,
      storeUrl: String,
    },
    menu: [{ type: mongoose.Schema.Types.ObjectId, ref: "InstaMenu" }],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "InstaOrder" }],
    bankDetails: {
      accountName: String,
      accountNumber: String,
      ifscCode: String,
      upiId: String,
    },
    razorpay: {
      linkedAccountId: { type: String, trim: true, default: null },
      commissionPercent: { type: Number, min: 0, max: 100, default: 15 },
      beneficiaryName: { type: String, trim: true },
      contactName: { type: String, trim: true },
      contactEmail: { type: String, lowercase: true, trim: true },
      contactPhone: { type: String, match: [/^[0-9]{10}$/, "Invalid phone"] },
      bankAccountNumber: { type: String, select: false },
      ifscCode: { type: String, trim: true, uppercase: true },
      legalBusinessName: { type: String, trim: true },
      businessType: {
        type: String,
        enum: [
          "proprietorship",
          "partnership",
          "private_limited",
          "public_limited",
          "llp",
          "ngo",
          "trust",
          "society",
          "not_yet_registered",
          "individual",
        ],
      },
      profileCategory: { type: String, trim: true, default: "food" },
      profileSubcategory: { type: String, trim: true, default: "restaurant" },
      address: {
        street1: String,
        street2: String,
        city: String,
        state: String,
        postalCode: String,
        country: { type: String, default: "IN" },
      },
      pan: { type: String, trim: true, uppercase: true, select: false },
      gst: { type: String, trim: true, uppercase: true, select: false },
      referenceId: { type: String, trim: true },
      onboardingStatus: {
        type: String,
        enum: [
          "pending",
          "created",
          "under_review",
          "needs_clarification",
          "active",
          "suspended",
          "rejected",
        ],
        default: "pending",
      },
      onboardingMeta: {
        lastSyncedAt: Date,
        rawStatus: String,
        rejectionReason: String,
      },
    },
    isVerified: { type: Boolean, default: false },
    sessions: [
      {
        tokenId: String,
        createdAt: Date,
        lastUsedAt: Date,
        ipAddress: String,
        userAgent: String,
        revokedAt: Date,
      },
    ],
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    isActive: { type: Boolean, default: true },
    credentialsVersion: { type: Number, default: 0 },
    lastLogin: Date,
    emailVerificationOTP: { type: String, select: false },
    emailVerificationExpiry: { type: Date, select: false },
    emailVerificationAttempts: { type: Number, default: 0, select: false },
    passwordResetOTP: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },
    passwordResetAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

storeSchema.pre("save", hashPasswordHook);
storeSchema.methods.comparePassword = comparePasswordMethod;
storeSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationToken;
  delete obj.bankDetails;
  delete obj.emailVerificationOTP;
  delete obj.emailVerificationExpiry;
  delete obj.emailVerificationAttempts;
  delete obj.passwordResetOTP;
  delete obj.passwordResetExpiry;
  delete obj.passwordResetAttempts;
  if (obj.razorpay) {
    delete obj.razorpay.bankAccountNumber;
    delete obj.razorpay.pan;
    delete obj.razorpay.gst;
  }
  return obj;
};

const Store =
  mongoose.models.InstaStore || mongoose.model("InstaStore", storeSchema);
export default Store;
