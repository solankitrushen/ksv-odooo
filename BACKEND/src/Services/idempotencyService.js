import crypto from "crypto";
import IdempotencyRecord from "../Schema/IdempotencyRecord.js";
import { QUOTATION_CONFIG } from "../../config/constants.js";

/**
 * idempotencyService — dedups create/submit calls within a TTL window
 * (SPEC-VB-003 NFR-3). Keyed per {tenantId, vendorUserId, scope, key}. A replay
 * with the SAME body returns the stored response; a replay with a DIFFERENT
 * body is rejected (fingerprint_mismatch) instead of silently re-running.
 */

function fingerprint(body) {
  const canonical = JSON.stringify(sortKeys(body ?? {}));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeys(value[k]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Look up a prior idempotent record.
 * @returns {Promise<{status:'replay'|'mismatch'|'miss', record?:object}>}
 */
export async function lookupIdempotency({ tenantId, vendorUserId, scope, key, body }) {
  if (!key) return { status: "miss" };
  const fp = fingerprint(body);
  const existing = await IdempotencyRecord.findOne({
    tenantId,
    vendorUserId,
    scope,
    key,
  }).lean();
  if (!existing) return { status: "miss" };
  if (existing.fingerprint !== fp) return { status: "mismatch" };
  return { status: "replay", record: existing };
}

/**
 * Persist the result of an idempotent operation. Best-effort; a duplicate key
 * race just means another request stored it first.
 */
export async function storeIdempotency({
  tenantId,
  vendorUserId,
  scope,
  key,
  body,
  statusCode,
  response,
}) {
  if (!key) return;
  const expiresAt = new Date(Date.now() + QUOTATION_CONFIG.idempotencyTtlS * 1000);
  try {
    await IdempotencyRecord.create({
      tenantId,
      vendorUserId,
      scope,
      key,
      fingerprint: fingerprint(body),
      statusCode,
      response,
      expiresAt,
    });
  } catch (err) {
    if (err?.code !== 11000) throw err; // ignore duplicate-key race
  }
}

export default { lookupIdempotency, storeIdempotency };
