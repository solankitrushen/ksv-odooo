import mongoose from "mongoose";
import { VENDOR_STATUS } from "../../config/constants.js";

const vendorSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
      maxlength: [150, "Name too long"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      maxlength: [80, "Category too long"],
    },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^[\w.-]+@[\w.-]+\.\w+$/, "Invalid email format"],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{7,15}$/, "Invalid phone number"],
    },
    gstNumber: { type: String, trim: true, uppercase: true, maxlength: 20 },
    status: {
      type: String,
      enum: Object.values(VENDOR_STATUS),
      default: VENDOR_STATUS.INVITED,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", required: true },
  },
  { timestamps: true }
);

vendorSchema.index({ tenantId: 1, email: 1 }, { unique: true });
vendorSchema.index({ tenantId: 1, category: 1 });
vendorSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

const Vendor = mongoose.models.Vendor || mongoose.model("Vendor", vendorSchema);
export default Vendor;
