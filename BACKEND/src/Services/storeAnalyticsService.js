import Order from "../Schema/Order.js";
import MenuItem from "../Schema/MenuItem.js";
import Combo from "../Schema/Combo.js";
import mongoose from "mongoose";
import {
  ORDER_STATUS,
  REVENUE_ORDER_STATUSES,
  PLATFORM_FEE_RATE,
} from "../../config/constants.js";
import { roundMoney } from "../Utils/priceCalculator.js";

const DASHBOARD_TTL_MS = 60 * 1000;
const cache = new Map();
const inflight = new Map();

function round2(n) {
  return roundMoney(Number(n) || 0);
}

function parseRange(query = {}) {
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
  const days = Math.ceil((to - from) / (24 * 60 * 60 * 1000));
  if (days > 365) {
    return { ok: false, message: "Range exceeds 365 days" };
  }
  return { ok: true, from, to, days };
}

function cacheKey(prefix, storeId, from, to) {
  return `${prefix}:${storeId}:${from.toISOString()}:${to.toISOString()}`;
}

async function singleFlight(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const res = await fn();
      cache.set(key, { value: res, at: Date.now() });
      return res;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > DASHBOARD_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export async function buildStoreDashboard(storeId, query = {}) {
  const range = parseRange(query);
  if (!range.ok) return range;
  const { from, to } = range;

  const key = cacheKey("dash", storeId, from, to);
  const cached = cacheGet(key);
  if (cached) return { ok: true, dashboard: cached, cacheHit: true };

  const dashboard = await singleFlight(key, async () => {
    const baseMatch = {
      // Aggregations do NOT auto-cast like .find() — storeId arrives as a string
      // from the JWT, but the field is an ObjectId, so it must be cast or the
      // $match silently returns nothing (empty dashboard despite real orders).
      storeId: mongoose.Types.ObjectId.isValid(storeId)
        ? new mongoose.Types.ObjectId(storeId)
        : storeId,
      createdAt: { $gte: from, $lte: to },
    };

    const [
      summaryAgg,
      statusAgg,
      hourAgg,
      dayAgg,
      zoneAgg,
      topItemsAgg,
      topCombosAgg,
      trendAgg,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { ...baseMatch, paymentStatus: "success", status: { $in: REVENUE_ORDER_STATUSES } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            grossRevenue: { $sum: "$totalAmount" },
            subtotalRevenue: { $sum: "$subtotal" },
            deliveryCharges: { $sum: "$deliveryCharge" },
          },
        },
      ]),
      Order.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { ...baseMatch, status: { $in: REVENUE_ORDER_STATUSES } } },
        {
          $project: {
            hour: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } },
            dow: { $dayOfWeek: { date: "$createdAt", timezone: "Asia/Kolkata" } },
            total: "$totalAmount",
          },
        },
        { $group: { _id: "$hour", count: { $sum: 1 }, revenue: { $sum: "$total" } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { ...baseMatch, status: { $in: REVENUE_ORDER_STATUSES } } },
        {
          $project: {
            dow: { $dayOfWeek: { date: "$createdAt", timezone: "Asia/Kolkata" } },
            hour: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } },
            total: "$totalAmount",
          },
        },
        {
          $group: {
            _id: { dow: "$dow", hour: "$hour" },
            count: { $sum: 1 },
            revenue: { $sum: "$total" },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        { $match: { ...baseMatch, status: { $in: REVENUE_ORDER_STATUSES } } },
        {
          $project: {
            cell: {
              $cond: [
                { $and: ["$deliveryLatitude", "$deliveryLongitude"] },
                {
                  $concat: [
                    { $toString: { $round: ["$deliveryLatitude", 2] } },
                    ",",
                    { $toString: { $round: ["$deliveryLongitude", 2] } },
                  ],
                },
                "unknown",
              ],
            },
            total: "$totalAmount",
          },
        },
        {
          $group: {
            _id: "$cell",
            count: { $sum: 1 },
            revenue: { $sum: "$total" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: { ...baseMatch, status: { $in: REVENUE_ORDER_STATUSES } } },
        { $unwind: "$items" },
        { $match: { "items.menuItemId": { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$items.menuItemId",
            name: { $first: "$items.name" },
            qty: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.lineTotal" },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: { ...baseMatch, status: { $in: REVENUE_ORDER_STATUSES } } },
        { $unwind: "$items" },
        { $match: { "items.comboId": { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$items.comboId",
            name: { $first: "$items.name" },
            qty: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.lineTotal" },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $match: { ...baseMatch, status: { $in: REVENUE_ORDER_STATUSES } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Kolkata",
              },
            },
            orderCount: { $sum: 1 },
            grossRevenue: { $sum: "$totalAmount" },
            subtotal: { $sum: "$subtotal" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const sum = summaryAgg[0] || {
      totalOrders: 0,
      grossRevenue: 0,
      subtotalRevenue: 0,
      deliveryCharges: 0,
    };
    const platformFee = round2(sum.subtotalRevenue * PLATFORM_FEE_RATE);

    const statusBreakdown = {};
    for (const s of Object.values(ORDER_STATUS)) statusBreakdown[s] = 0;
    for (const row of statusAgg) statusBreakdown[row._id] = row.count;
    statusBreakdown.failed =
      (statusBreakdown.rejected || 0) + (statusBreakdown.cancelled || 0);

    const peakHours = hourAgg.map((h) => ({
      hour: h._id,
      count: h.count,
      revenue: round2(h.revenue),
    }));

    const heatmap = [];
    for (let dow = 1; dow <= 7; dow++) {
      const row = { dayOfWeek: dow, hours: Array(24).fill(0) };
      heatmap.push(row);
    }
    for (const cell of dayAgg) {
      const row = heatmap.find((r) => r.dayOfWeek === cell._id.dow);
      if (row) row.hours[cell._id.hour] = cell.count;
    }

    const peakZones = zoneAgg.map((z) => ({
      cell: z._id,
      count: z.count,
      revenue: round2(z.revenue),
    }));

    const topItems = topItemsAgg.map((r, i) => ({
      menuItemId: String(r._id),
      name: r.name,
      qty: r.qty,
      revenue: round2(r.revenue),
      rank: i + 1,
    }));
    const topCombos = topCombosAgg.map((r, i) => ({
      comboId: String(r._id),
      name: r.name,
      qty: r.qty,
      revenue: round2(r.revenue),
      rank: i + 1,
    }));

    const revenueTrend = trendAgg.map((r) => ({
      date: r._id,
      orderCount: r.orderCount,
      grossRevenue: round2(r.grossRevenue),
      subtotal: round2(r.subtotal),
    }));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalOrders: sum.totalOrders,
        grossRevenue: round2(sum.grossRevenue),
        subtotalRevenue: round2(sum.subtotalRevenue),
        deliveryCharges: round2(sum.deliveryCharges),
        platformFee,
        netAfterPlatformFee: round2(sum.grossRevenue - platformFee),
        avgBasket:
          sum.totalOrders > 0
            ? round2(sum.grossRevenue / sum.totalOrders)
            : 0,
      },
      statusBreakdown,
      peakHours,
      heatmap,
      peakZones,
      topItems,
      topCombos,
      revenueTrend,
    };
  });

  return { ok: true, dashboard, cacheHit: false };
}

function mask(value, kind) {
  if (!value) return "—";
  if (kind === "phone") {
    const s = String(value);
    return s.length <= 4 ? s : `${"•".repeat(s.length - 4)} ${s.slice(-4)}`;
  }
  if (kind === "email") {
    const [name, host] = String(value).split("@");
    if (!host) return "—";
    return `${name[0] || ""}***@${host}`;
  }
  return "—";
}

export async function listFailedOrders(storeId, query = {}) {
  const range = parseRange(query);
  if (!range.ok) return range;
  const { from, to } = range;
  const page = Number(query.page) || 1;
  const pageSize = Math.min(Number(query.pageSize) || 25, 100);
  const skip = (page - 1) * pageSize;

  const filter = {
    storeId,
    createdAt: { $gte: from, $lte: to },
    $or: [
      { status: { $in: [ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED] } },
      { paymentStatus: "failed" },
    ],
  };

  const [rowsRaw, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate({ path: "userId", select: "name email phone" })
      .lean(),
    Order.countDocuments(filter),
  ]);

  const rows = rowsRaw.map((o) => {
    let failureCategory = "unknown";
    if (o.status === ORDER_STATUS.REJECTED) failureCategory = "rejected_by_store";
    else if (o.status === ORDER_STATUS.CANCELLED) failureCategory = "cancelled_by_user";
    else if (o.paymentStatus === "failed") failureCategory = "payment_failed";

    let reason = o.rejectReason || null;
    if (!reason && o.statusHistory?.length) {
      const last = [...o.statusHistory].reverse().find((s) => s.note);
      reason = last?.note || null;
    }
    if (!reason && failureCategory === "payment_failed") {
      reason = "Payment was not completed";
    }

    return {
      id: String(o._id),
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      itemCount: (o.items || []).reduce((n, l) => n + (l.quantity || 0), 0),
      failureCategory,
      reason,
      customer: {
        name: o.userId?.name || "—",
        phoneMasked: mask(o.userId?.phone, "phone"),
        emailMasked: mask(o.userId?.email, "email"),
      },
      reviewed: Boolean(o.failureReview?.reviewedAt),
      reviewedAt: o.failureReview?.reviewedAt || null,
      reviewNotes: o.failureReview?.notes || "",
      statusHistory: o.statusHistory || [],
    };
  });

  const filteredRows = query.category
    ? rows.filter((r) => r.failureCategory === query.category)
    : rows;

  const summary = {
    rejected_by_store: 0,
    cancelled_by_user: 0,
    payment_failed: 0,
    unknown: 0,
  };
  for (const r of rows) summary[r.failureCategory] = (summary[r.failureCategory] || 0) + 1;

  return {
    ok: true,
    failedOrders: filteredRows,
    summary,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    period: { from: from.toISOString(), to: to.toISOString() },
  };
}

export async function reviewFailedOrder(storeId, orderId, actorId, notes) {
  const order = await Order.findOne({ _id: orderId, storeId });
  if (!order) return { ok: false, message: "Order not found" };

  order.failureReview = {
    reviewedBy: actorId,
    reviewedAt: new Date(),
    notes: notes || "",
  };
  await order.save();
  return { ok: true, order: { id: String(order._id), failureReview: order.failureReview } };
}
