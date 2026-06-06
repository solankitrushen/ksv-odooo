import RfqCounter from "../Schema/RfqCounter.js";

export async function nextRfqReference(tenantId, now = new Date()) {
  const year = now.getUTCFullYear();
  const doc = await RfqCounter.findOneAndUpdate(
    { tenantId, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `RFQ-${year}-${String(doc.seq).padStart(4, "0")}`;
}
