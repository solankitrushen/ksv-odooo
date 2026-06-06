import mongoose from "mongoose";

const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    value: { type: Number, required: true, min: 0 },
    applicableTo: {
      type: String,
      enum: ["items", "combos", "both"],
      required: true,
    },
    targetItemIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "InstaMenuItem" },
    ],
    targetComboIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "InstaCombo" },
    ],
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

discountSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });

const Discount =
  mongoose.models.InstaDiscount ||
  mongoose.model("InstaDiscount", discountSchema);

export default Discount;
