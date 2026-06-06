import mongoose from "mongoose";
import Rfq from "../Schema/Rfq.js";
import Quotation from "../Schema/Quotation.js";
import PurchaseOrder from "../Schema/PurchaseOrder.js";
import Invoice from "../Schema/Invoice.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  QUOTATION_APPROVAL_STATUS,
  QUOTATION_STATUS,
  RFQ_STATUS,
} from "../../config/constants.js";

function countByStatus(rows, statuses) {
  const out = {};
  for (const s of statuses) out[s] = 0;
  for (const r of rows) if (out[r._id] !== undefined) out[r._id] = r.count;
  out.total = rows.reduce((a, r) => a + r.count, 0);
  return out;
}

// ---------------------------------------------------------------------------
// GET /api/v1/vb/vendor/analytics — vendor-scoped dashboard (VENDOR role only).
// Only ever reads THIS vendor's own data. No cross-vendor exposure.
// ---------------------------------------------------------------------------
export async function vendorDashboard(req, res) {
  const tenantId = req.tenantId;
  const vendorId = req.membership?.vendorId;
  if (!vendorId) return sendError(res, 403, "Forbidden", "No vendor membership");
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const vid = new mongoose.Types.ObjectId(String(vendorId));

  const [assignedRfqs, quotationAgg, wonAgg, pos, invoices, recentRfqs, myQuotes] =
    await Promise.all([
      Rfq.countDocuments({ tenantId, status: RFQ_STATUS.ACTIVE, assignedVendors: vendorId }),
      Quotation.aggregate([
        { $match: { tenantId: tid, vendorId: vid } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Quotation.aggregate([
        { $match: { tenantId: tid, vendorId: vid, "approval.status": QUOTATION_APPROVAL_STATUS.APPROVED } },
        { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$computed.grandTotal" } } },
      ]),
      PurchaseOrder.countDocuments({ tenantId, vendorId }),
      Invoice.countDocuments({ tenantId, vendorId }),
      Rfq.find({ tenantId, status: RFQ_STATUS.ACTIVE, assignedVendors: vendorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("reference title deadline priority createdAt")
        .lean(),
      Quotation.find({ tenantId, vendorId })
        .select("rfqId status approval.status computed.grandTotal")
        .lean(),
    ]);

  const quotations = countByStatus(quotationAgg, [
    QUOTATION_STATUS.DRAFT,
    QUOTATION_STATUS.SUBMITTED,
    QUOTATION_STATUS.WITHDRAWN,
    QUOTATION_STATUS.EXPIRED,
  ]);
  const byRfq = new Map(myQuotes.map((q) => [String(q.rfqId), q]));
  const won = wonAgg[0] || { count: 0, value: 0 };

  return sendSuccess(res, 200, {
    rfqs: { assigned: assignedRfqs },
    quotations,
    won: { count: won.count, value: won.value },
    purchaseOrders: pos,
    invoices,
    recentRfqs: recentRfqs.map((r) => {
      const mine = byRfq.get(String(r._id));
      return {
        ...r,
        myQuotation: mine
          ? {
              status: mine.status,
              approvalStatus: mine.approval?.status ?? "pending",
              grandTotal: mine.computed?.grandTotal ?? 0,
            }
          : null,
      };
    }),
  });
}
