import mongoose from "mongoose";
import Vendor from "../Schema/Vendor.js";
import Rfq from "../Schema/Rfq.js";
import Quotation from "../Schema/Quotation.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  QUOTATION_STATUS,
  RFQ_STATUS,
  VB_ROLES,
  VENDOR_STATUS,
} from "../../config/constants.js";

function isStaff(roles = []) {
  return (
    roles.includes(VB_ROLES.ADMIN) ||
    roles.includes(VB_ROLES.OFFICER) ||
    roles.includes(VB_ROLES.MANAGER)
  );
}

function countByStatus(rows, statuses) {
  const out = {};
  for (const s of statuses) out[s] = 0;
  for (const r of rows) {
    if (out[r._id] !== undefined) out[r._id] = r.count;
  }
  out.total = rows.reduce((a, r) => a + r.count, 0);
  return out;
}

// ---------------------------------------------------------------------------
// GET /api/v1/vb/analytics/dashboard — staff overview (admin / officer / manager)
// All money is integer paise. Cost is summed from SUBMITTED quotations only.
// ---------------------------------------------------------------------------
export async function dashboardAnalytics(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const tid = new mongoose.Types.ObjectId(String(tenantId));

  const [
    vendorAgg,
    rfqAgg,
    quotationAgg,
    submittedValueAgg,
    recentRfqs,
    recentSubmissions,
    topVendorsAgg,
  ] = await Promise.all([
    Vendor.aggregate([
      { $match: { tenantId: tid } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Rfq.aggregate([
      { $match: { tenantId: tid } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Quotation.aggregate([
      { $match: { tenantId: tid } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    // total + average quoted value across SUBMITTED quotations
    Quotation.aggregate([
      { $match: { tenantId: tid, status: QUOTATION_STATUS.SUBMITTED } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$computed.grandTotal" },
          avgValue: { $avg: "$computed.grandTotal" },
          avgCoverage: { $avg: "$computed.coverage" },
          count: { $sum: 1 },
        },
      },
    ]),
    Rfq.find({ tenantId: tid })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("reference title status priority deadline createdAt")
      .lean(),
    Quotation.find({ tenantId: tid, status: QUOTATION_STATUS.SUBMITTED })
      .sort({ submittedAt: -1 })
      .limit(5)
      .select("rfqId vendorId status computed.grandTotal computed.coverage submittedAt currency")
      .lean(),
    // top vendors by submitted-quote value
    Quotation.aggregate([
      { $match: { tenantId: tid, status: QUOTATION_STATUS.SUBMITTED } },
      {
        $group: {
          _id: "$vendorId",
          totalValue: { $sum: "$computed.grandTotal" },
          submissions: { $sum: 1 },
        },
      },
      { $sort: { totalValue: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const vendors = countByStatus(vendorAgg, [
    VENDOR_STATUS.ACTIVE,
    VENDOR_STATUS.INVITED,
    VENDOR_STATUS.INACTIVE,
  ]);
  const rfqs = countByStatus(rfqAgg, [
    RFQ_STATUS.DRAFT,
    RFQ_STATUS.ACTIVE,
    RFQ_STATUS.CLOSED,
  ]);
  const quotations = countByStatus(quotationAgg, [
    QUOTATION_STATUS.DRAFT,
    QUOTATION_STATUS.SUBMITTED,
    QUOTATION_STATUS.WITHDRAWN,
    QUOTATION_STATUS.EXPIRED,
  ]);

  const value = submittedValueAgg[0] || {
    totalValue: 0,
    avgValue: 0,
    avgCoverage: 0,
    count: 0,
  };

  // resolve vendor names for recent submissions + top vendors
  const vendorIds = [
    ...new Set([
      ...recentSubmissions.map((q) => String(q.vendorId)),
      ...topVendorsAgg.map((t) => String(t._id)),
    ]),
  ];
  const vendorDocs = await Vendor.find({ tenantId: tid, _id: { $in: vendorIds } })
    .select("name category")
    .lean();
  const vendorName = new Map(vendorDocs.map((v) => [String(v._id), v]));

  const rfqIds = [...new Set(recentSubmissions.map((q) => String(q.rfqId)))];
  const rfqDocs = await Rfq.find({ tenantId: tid, _id: { $in: rfqIds } })
    .select("reference title")
    .lean();
  const rfqRef = new Map(rfqDocs.map((r) => [String(r._id), r]));

  return sendSuccess(res, 200, {
    vendors,
    rfqs,
    quotations,
    cost: {
      totalSubmittedValue: value.totalValue || 0,
      avgSubmittedValue: Math.round(value.avgValue || 0),
      avgCoverage: value.avgCoverage || 0,
      submittedCount: value.count || 0,
    },
    recentRfqs,
    recentSubmissions: recentSubmissions.map((q) => ({
      ...q,
      vendor: vendorName.get(String(q.vendorId)) || null,
      rfq: rfqRef.get(String(q.rfqId)) || null,
    })),
    topVendors: topVendorsAgg.map((t) => ({
      vendorId: t._id,
      vendor: vendorName.get(String(t._id)) || null,
      totalValue: t.totalValue,
      submissions: t.submissions,
    })),
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/vb/analytics/reports — spend by category, top vendors by spend,
// monthly procurement trends (spec screen 11). Spend = APPROVED quotations.
// ---------------------------------------------------------------------------
export async function reportsAnalytics(req, res) {
  const { tenantId, roles } = req;
  if (!isStaff(roles)) return sendError(res, 403, "Forbidden", "Staff only");
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const APPROVED = { tenantId: tid, "approval.status": "approved" };

  const [byVendorAgg, monthlyAgg, totalAgg] = await Promise.all([
    Quotation.aggregate([
      { $match: APPROVED },
      {
        $group: {
          _id: "$vendorId",
          spend: { $sum: "$computed.grandTotal" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { spend: -1 } },
    ]),
    Quotation.aggregate([
      { $match: APPROVED },
      {
        $group: {
          _id: {
            y: { $year: "$approval.decidedAt" },
            m: { $month: "$approval.decidedAt" },
          },
          spend: { $sum: "$computed.grandTotal" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
    ]),
    Quotation.aggregate([
      { $match: APPROVED },
      { $group: { _id: null, spend: { $sum: "$computed.grandTotal" }, orders: { $sum: 1 } } },
    ]),
  ]);

  // resolve vendor name + category
  const vendorIds = byVendorAgg.map((r) => r._id);
  const vendorDocs = await Vendor.find({ tenantId: tid, _id: { $in: vendorIds } })
    .select("name category")
    .lean();
  const vMap = new Map(vendorDocs.map((v) => [String(v._id), v]));

  // spend by category
  const catMap = new Map();
  for (const r of byVendorAgg) {
    const cat = vMap.get(String(r._id))?.category || "Uncategorized";
    catMap.set(cat, (catMap.get(cat) || 0) + r.spend);
  }
  const spendByCategory = [...catMap.entries()]
    .map(([category, spend]) => ({ category, spend }))
    .sort((a, b) => b.spend - a.spend);

  const topVendorsBySpend = byVendorAgg.slice(0, 10).map((r) => ({
    vendorId: r._id,
    vendor: vMap.get(String(r._id)) || null,
    spend: r.spend,
    orders: r.orders,
  }));

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyTrends = monthlyAgg.map((m) => ({
    label: `${MONTHS[(m._id.m || 1) - 1]} ${m._id.y}`,
    spend: m.spend,
    orders: m.orders,
  }));

  return sendSuccess(res, 200, {
    totals: {
      totalSpend: totalAgg[0]?.spend || 0,
      totalOrders: totalAgg[0]?.orders || 0,
    },
    spendByCategory,
    topVendorsBySpend,
    monthlyTrends,
  });
}
