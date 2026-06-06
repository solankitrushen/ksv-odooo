import mongoose from "mongoose";

const comboLineSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstaMenuItem",
      required: true,
    },
    qty: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const comboSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    items: {
      type: [comboLineSchema],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length >= 2;
        },
        message: "Combo must include at least 2 items",
      },
    },
    comboPrice: { type: Number, required: true, min: 0.01 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

comboSchema.index({ isActive: 1 });

const Combo =
  mongoose.models.InstaCombo || mongoose.model("InstaCombo", comboSchema);

export default Combo;
