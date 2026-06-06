import mongoose from "mongoose";

const rfqCounterSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

rfqCounterSchema.index({ tenantId: 1, year: 1 }, { unique: true });

const RfqCounter =
  mongoose.models.RfqCounter || mongoose.model("RfqCounter", rfqCounterSchema);
export default RfqCounter;
