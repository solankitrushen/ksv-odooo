import mongoose from "mongoose";

/**
 * Idempotency ledger (NFR-3 core). Keyed per tenant+vendor+key. Stores a
 * fingerprint of the request body so a replay with a different body is rejected
 * (fingerprint_mismatch) instead of silently returning a stale response.
 * TTL-indexed via expiresAt.
 */
const idempotencyRecordSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    vendorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VbUser",
      required: true,
    },
    key: { type: String, required: true, trim: true, maxlength: 200 },
    scope: { type: String, required: true, trim: true, maxlength: 60 }, // e.g. "quotation.create"
    fingerprint: { type: String, required: true }, // sha256 of canonical body
    statusCode: { type: Number, default: null },
    response: { type: mongoose.Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// dedup key is unique per tenant+user+scope+key
idempotencyRecordSchema.index(
  { tenantId: 1, vendorUserId: 1, scope: 1, key: 1 },
  { unique: true }
);
// TTL cleanup
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const IdempotencyRecord =
  mongoose.models.IdempotencyRecord ||
  mongoose.model("IdempotencyRecord", idempotencyRecordSchema);
export default IdempotencyRecord;
