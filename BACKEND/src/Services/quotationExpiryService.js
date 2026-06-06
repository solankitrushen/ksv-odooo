import Quotation from "../Schema/Quotation.js";
import { QUOTATION_STATUS, QUOTATION_CONFIG } from "../../config/constants.js";
import { logger } from "../Utils/logger.js";

/**
 * quotationExpiryService — flips past-deadline drafts to `expired`
 * (SPEC-VB-003 FR-12). Runs on an interval in long-lived processes and inline
 * (expireOne) on every quotation read so tests/responses are deterministic.
 */

let timer = null;

/**
 * Atomically expire all past-deadline drafts (optionally scoped to a tenant/rfq).
 * @returns {Promise<number>} number of quotations expired
 */
export async function tick(filter = {}) {
  const now = new Date();
  const res = await Quotation.updateMany(
    {
      ...filter,
      status: QUOTATION_STATUS.DRAFT,
      deadline: { $lte: now },
    },
    { $set: { status: QUOTATION_STATUS.EXPIRED } }
  );
  const n = res.modifiedCount ?? res.nModified ?? 0;
  if (n > 0) logger.info?.("quotationExpiry: expired drafts", { count: n });
  return n;
}

/**
 * Inline, on-demand expiry for a single quotation doc/id. Returns the (possibly
 * updated) lean quotation so reads always reflect deadline state.
 */
export async function expireOne(quotationId) {
  const now = new Date();
  await Quotation.updateOne(
    {
      _id: quotationId,
      status: QUOTATION_STATUS.DRAFT,
      deadline: { $lte: now },
    },
    { $set: { status: QUOTATION_STATUS.EXPIRED } }
  );
}

export function startExpiryWorker() {
  if (timer) return timer;
  const ms = QUOTATION_CONFIG.expiryTickMs;
  timer = setInterval(() => {
    tick().catch((err) => logger.error?.("quotationExpiry tick failed", { err: err.message }));
  }, ms);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

export function stopExpiryWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export default { tick, expireOne, startExpiryWorker, stopExpiryWorker };
