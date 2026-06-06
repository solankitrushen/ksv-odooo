import SeqCounter from "../Schema/SeqCounter.js";

const PREFIX = {
  ticket: "TKT",
  invoice: "INV",
  purchaseOrder: "PO",
};

/**
 * Mint the next reference for a given kind, e.g. nextReference(tid, "invoice")
 * → "INV-2026-0001". Atomic per {tenantId, kind, year}.
 */
export async function nextReference(tenantId, kind, now = new Date()) {
  const year = now.getUTCFullYear();
  const doc = await SeqCounter.findOneAndUpdate(
    { tenantId, kind, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const prefix = PREFIX[kind] || kind.toUpperCase();
  return `${prefix}-${year}-${String(doc.seq).padStart(4, "0")}`;
}
