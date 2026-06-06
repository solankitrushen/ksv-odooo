import mongoose from "mongoose";
import { hashPasswordHook, comparePasswordMethod } from "./shared/passwordHooks.js";

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^[\w.-]+@[\w.-]+\.\w+$/, "Invalid email"],
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    name: { type: String, default: "Platform Admin" },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
    },
    permissions: [String],
    lastLogin: Date,
    loginHistory: [
      {
        timestamp: Date,
        ip: String,
        userAgent: String,
      },
    ],
    isActive: { type: Boolean, default: true },
    passwordResetOTP: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },
    passwordResetAttempts: { type: Number, default: 0, select: false },
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
  },
  { timestamps: true }
);

adminSchema.pre("save", hashPasswordHook);
adminSchema.methods.comparePassword = comparePasswordMethod;
adminSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetOTP;
  delete obj.passwordResetExpiry;
  delete obj.passwordResetAttempts;
  return obj;
};

const Admin =
  mongoose.models.InstaAdmin || mongoose.model("InstaAdmin", adminSchema);
export default Admin;
