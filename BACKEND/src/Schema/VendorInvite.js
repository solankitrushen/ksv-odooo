import mongoose from "mongoose";
import { INVITE_STATUS } from "../../config/constants.js";

const vendorInviteSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[\w.-]+@[\w.-]+\.\w+$/, "Invalid email format"],
    },
    tokenHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: Object.values(INVITE_STATUS),
      default: INVITE_STATUS.PENDING,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", required: true },
  },
  { timestamps: true }
);

vendorInviteSchema.index({ tenantId: 1, email: 1, status: 1 });

const VendorInvite =
  mongoose.models.VendorInvite ||
  mongoose.model("VendorInvite", vendorInviteSchema);
export default VendorInvite;
