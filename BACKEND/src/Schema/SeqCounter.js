import mongoose from "mongoose";

/**
 * Generic monotonic counter keyed by {tenantId, kind, year}. Used to mint
 * human-readable references like TKT-2026-0001 / INV-2026-0001 without
 * colliding with the RFQ counter.
 */
const seqCounterSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    kind: { type: String, required: true }, // "ticket" | "invoice"
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

seqCounterSchema.index({ tenantId: 1, kind: 1, year: 1 }, { unique: true });

const SeqCounter =
  mongoose.models.SeqCounter || mongoose.model("SeqCounter", seqCounterSchema);
export default SeqCounter;
