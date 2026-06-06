import Order from "../Schema/Order.js";
import Store from "../Schema/Store.js";
import {
  ORDER_STATUS,
  PLATFORM_FEE_RATE,
  REVENUE_ORDER_STATUSES,
} from "../../config/constants.js";
import { roundMoney } from "../Utils/priceCalculator.js";

const VALUE_BUCKETS = [
  { label: "0-100", min: 0, max: 100 },
  { label: "101-250", min: 101, max: 250 },
  { label: "251-500", min: 251, max: 500 },
  { label: "501-1000", min: 501, max: 1000 },
  { label: "1000+", min: 1001, max: Infinity },
];

function parseDateRange(query = {}) {
  const now = new Date();
  const to = query.to ? new Date(query.to) : now;
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, message: "Invalid from or to date" };
  }
  if (from > to) {
    return { ok: false, message: "from must be before to" };
  }

  return { ok: true, from, to };
}

function round2(n) {
  return roundMoney(Number(n) || 0);
}

export async function buildAdminDashboard(query = {}) {
  const range = parseDateRange(query);
  if (!range.ok) return range;

  const { from, to } = range;
  const match = {
    createdAt: { $gte: from, $lte: to },
    paymentStatus: "success",
  };

  const orders = await Order.find(match).lean();

  const statusBreakdown = {};
  for (const s of Object.values(ORDER_STATUS)) {
    statusBreakdown[s] = 0;
  }

  let grossRevenue = 0;
  let deliveryCharges = 0;
  let subtotalSum = 0;
  const hourCounts = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: 0,
  }));
  const bucketCounts = VALUE_BUCKETS.map((b) => ({
    label: b.label,
    count: 0,
  }));

  for (const o of orders) {
    statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;

    if (REVENUE_ORDER_STATUSES.includes(o.status)) {
      grossRevenue += o.totalAmount;
      subtotalSum += o.subtotal;
      deliveryCharges += o.deliveryCharge || 0;
    }

    const hour = new Date(o.createdAt).getHours();
    hourCounts[hour].count += 1;

    const bucket = VALUE_BUCKETS.find(
      (b) => o.totalAmount >= b.min && o.totalAmount <= b.max
    );
    if (bucket) {
      const idx = VALUE_BUCKETS.indexOf(bucket);
      bucketCounts[idx].count += 1;
    }
  }

  const platformFee = round2(subtotalSum * PLATFORM_FEE_RATE);
  const peakHour = hourCounts.reduce((best, row) =>
    row.count > best.count ? row : best
  );

  return {
    ok: true,
    dashboard: {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      summary: {
        totalOrders: orders.length,
        grossRevenue: round2(grossRevenue),
        subtotalRevenue: round2(subtotalSum),
        platformFeeRate: PLATFORM_FEE_RATE,
        platformFee,
        netAfterPlatformFee: round2(grossRevenue - platformFee),
        totalDeliveryCharges: round2(deliveryCharges),
      },
      statusBreakdown: {
        pending: statusBreakdown.pending || 0,
        accepted: statusBreakdown.accepted || 0,
        preparing: statusBreakdown.preparing || 0,
        ready: statusBreakdown.ready || 0,
        in_delivery: statusBreakdown.in_delivery || 0,
        delivered: statusBreakdown.delivered || 0,
        rejected: statusBreakdown.rejected || 0,
        cancelled: statusBreakdown.cancelled || 0,
        failed: statusBreakdown.rejected + (statusBreakdown.cancelled || 0),
      },
      peakHours: hourCounts
        .filter((h) => h.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      peakHour: peakHour.count > 0 ? peakHour : null,
      orderValueDistribution: bucketCounts,
    },
  };
}

export async function buildPerStoreAnalytics(query = {}) {
  const range = parseDateRange(query);
  if (!range.ok) return range;

  const { from, to } = range;
  const match = {
    createdAt: { $gte: from, $lte: to },
    paymentStatus: "success",
  };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: "$storeId",
        totalOrders: { $sum: 1 },
        grossRevenue: { $sum: "$totalAmount" },
        subtotal: { $sum: "$subtotal" },
        deliveryCharges: { $sum: "$deliveryCharge" },
      },
    },
    { $sort: { grossRevenue: -1 } },
  ];

  const rows = await Order.aggregate(pipeline);

  // Per-store trending items
  const trendingPipeline = [
    { $match: match },
    { $unwind: "$items" },
    { $match: { "items.menuItemId": { $exists: true, $ne: null } } },
    {
      $group: {
        _id: { storeId: "$storeId", menuItemId: "$items.menuItemId" },
        name: { $first: "$items.name" },
        qty: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
      },
    },
    { $sort: { qty: -1 } },
  ];

  const trendingRaw = await Order.aggregate(trendingPipeline);

  const trendingByStore = {};
  for (const row of trendingRaw) {
    const sid = String(row._id.storeId);
    if (!trendingByStore[sid]) trendingByStore[sid] = [];
    trendingByStore[sid].push({
      menuItemId: String(row._id.menuItemId),
      name: row.name,
      qty: row.qty,
      revenue: round2(row.revenue),
    });
  }

  // Load all store names + ordering config
  const storeIds = rows.map((r) => r._id);
  const stores = await Store.find({ _id: { $in: storeIds } }).select(
    "name email phone location ordering razorpay.commissionPercent isActive"
  ).lean();

  const storeMap = new Map();
  for (const s of stores) {
    storeMap.set(String(s._id), {
      id: String(s._id),
      name: s.name,
      email: s.email,
      phone: s.phone,
      isActive: s.isActive,
      location: s.location,
      ordering: s.ordering,
      commissionPercent: s.razorpay?.commissionPercent ?? 15,
    });
  }

  const perStore = rows.map((r) => {
    const sid = String(r._id);
    const storeInfo = storeMap.get(sid) || { id: sid, name: "Unknown" };
    return {
      store: storeInfo,
      totalOrders: r.totalOrders,
      grossRevenue: round2(r.grossRevenue),
      subtotal: round2(r.subtotal),
      deliveryCharges: round2(r.deliveryCharges),
      platformFee: round2(r.subtotal * PLATFORM_FEE_RATE),
      netAfterPlatformFee: round2(r.grossRevenue - round2(r.subtotal * PLATFORM_FEE_RATE)),
      avgBasket: r.totalOrders > 0 ? round2(r.grossRevenue / r.totalOrders) : 0,
      trendingItems: (trendingByStore[sid] || []).slice(0, 5),
    };
  });

  return {
    ok: true,
    perStore,
    period: { from: from.toISOString(), to: to.toISOString() },
  };
}

export async function buildSalesReport(query = {}) {
  const range = parseDateRange(query);
  if (!range.ok) return range;

  const groupBy = query.groupBy || "day";
  if (!["day", "week", "month"].includes(groupBy)) {
    return { ok: false, message: "groupBy must be day, week, or month" };
  }

  const { from, to } = range;

  const dateFormat =
    groupBy === "month"
      ? "%Y-%m"
      : groupBy === "week"
        ? "%Y-W%V"
        : "%Y-%m-%d";

  const pipeline = [
    {
      $match: {
        createdAt: { $gte: from, $lte: to },
        paymentStatus: "success",
        status: { $in: REVENUE_ORDER_STATUSES },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: dateFormat, date: "$createdAt" },
        },
        orderCount: { $sum: 1 },
        grossRevenue: { $sum: "$totalAmount" },
        subtotal: { $sum: "$subtotal" },
        deliveryCharges: { $sum: "$deliveryCharge" },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const rows = await Order.aggregate(pipeline);

  const series = rows.map((r) => {
    const subtotal = round2(r.subtotal);
    const platformFee = round2(subtotal * PLATFORM_FEE_RATE);
    return {
      period: r._id,
      orderCount: r.orderCount,
      grossRevenue: round2(r.grossRevenue),
      subtotal: subtotal,
      deliveryCharges: round2(r.deliveryCharges),
      platformFee,
      netAfterPlatformFee: round2(r.grossRevenue - platformFee),
    };
  });

  const totals = series.reduce(
    (acc, row) => {
      acc.orderCount += row.orderCount;
      acc.grossRevenue += row.grossRevenue;
      acc.subtotal += row.subtotal;
      acc.deliveryCharges += row.deliveryCharges;
      acc.platformFee += row.platformFee;
      return acc;
    },
    {
      orderCount: 0,
      grossRevenue: 0,
      subtotal: 0,
      deliveryCharges: 0,
      platformFee: 0,
    }
  );

  totals.grossRevenue = round2(totals.grossRevenue);
  totals.subtotal = round2(totals.subtotal);
  totals.deliveryCharges = round2(totals.deliveryCharges);
  totals.platformFee = round2(totals.platformFee);
  totals.netAfterPlatformFee = round2(totals.grossRevenue - totals.platformFee);

  return {
    ok: true,
    report: {
      period: { from: from.toISOString(), to: to.toISOString() },
      groupBy,
      totals,
      series,
    },
  };
}
