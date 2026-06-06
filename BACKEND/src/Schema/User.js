import mongoose from "mongoose";
import { hashPasswordHook, comparePasswordMethod } from "./shared/passwordHooks.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name too long"],
    },
    email: {
      type: String,
      match: [/^[\w.-]+@[\w.-]+\.\w+$/, "Invalid email format"],
      lowercase: true,
      sparse: true,
      unique: true,
    },
    phone: {
      type: String,
      match: [/^[0-9]{10}$/, "Invalid phone number (10 digits)"],
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 chars"],
      select: false,
    },
    primaryIdentifier: {
      type: String,
      enum: ["email", "phone"],
      required: true,
    },
    role: { type: String, enum: ["user"], default: "user" },
    // Kept for backward compatibility — migrated to addresses[] on first address write.
    address: {
      street: String,
      city: String,
      zipCode: String,
    },
    addresses: [
      {
        label: { type: String, default: "Home", maxlength: 50 },
        houseNo: { type: String, required: true, maxlength: 50 },
        building: { type: String, maxlength: 100 },
        street: { type: String, required: true, maxlength: 200 },
        area: { type: String, maxlength: 100 },
        city: { type: String, required: true, maxlength: 100 },
        zipCode: { type: String, maxlength: 10 },
        landmark: { type: String, maxlength: 200 },
        latitude: { type: Number, min: -90, max: 90 },
        longitude: { type: Number, min: -180, max: 180 },
        isDefault: { type: Boolean, default: false },
      },
    ],
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, select: false },
    verificationExpiry: { type: Date, select: false },
    verificationAttempts: { type: Number, default: 0 },
    verificationLockedUntil: { type: Date, select: false },
    resendAttempts: { type: Number, default: 0 },
    resendWindowStart: { type: Date },
    loginOTP: { type: String, select: false },
    loginOTPExpiry: { type: Date, select: false },
    loginOTPAttempts: { type: Number, default: 0 },
    passwordResetOTP: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },
    passwordResetAttempts: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    accountLockedUntil: { type: Date },
    oauthProviders: [
      {
        provider: { type: String, enum: ["google", "apple", "github"] },
        providerId: String,
        email: String,
        displayName: String,
        linkedAt: Date,
      },
    ],
    sessions: [
      {
        tokenId: String,
        createdAt: Date,
        lastUsedAt: Date,
        ipAddress: String,
        userAgent: String,
        deviceName: String,
        revokedAt: Date,
      },
    ],
    loginHistory: [
      {
        timestamp: Date,
        method: String,
        ip: String,
        userAgent: String,
        success: Boolean,
        failureReason: String,
      },
    ],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "InstaOrder" }],
    paymentMethods: [
      {
        type: { type: String, enum: ["upi", "card", "wallet"] },
        upiId: String,
        primary: Boolean,
      },
    ],
    lastLogin: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", function requireIdentifier(next) {
  if (!this.isNew) return next();
  if (!this.email && !this.phone) {
    return next(new Error("User must have email or phone"));
  }
  if (this.primaryIdentifier === "email" && !this.password) {
    return next(new Error("Password required for email registration"));
  }
  if (this.primaryIdentifier === "phone" && !this.password) {
    return next(new Error("Password required for phone registration"));
  }
  next();
});

userSchema.pre("save", hashPasswordHook);
userSchema.methods.comparePassword = comparePasswordMethod;

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationToken;
  delete obj.verificationExpiry;
  delete obj.loginOTP;
  delete obj.loginOTPExpiry;
  return obj;
};

const User = mongoose.models.InstaUser || mongoose.model("InstaUser", userSchema);
export default User;
