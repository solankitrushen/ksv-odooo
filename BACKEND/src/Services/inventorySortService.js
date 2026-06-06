import Order from "../Schema/Order.js";
import { REVENUE_ORDER_STATUSES } from "../../config/constants.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function setCache(key, value) {
  cache.set(key, { value, at: Date.now() });
}

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function rangeKey(kind, days, storeId) {
  return `${kind}:${days}:${storeId || "global"}`;
}

async function topItemsByQty({ days = 30, storeId = null, limit = 100 }) {
  const key = rangeKey("items", days, storeId);
  const cached = getCache(key);
  if (cached) return cached;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match = {
    createdAt: { $gte: since },
    status: { $in: REVENUE_ORDER_STATUSES },
    paymentStatus: "success",
  };
  if (storeId) match.storeId = storeId;

  const rows = await Order.aggregate([
    { $match: match },
    { $unwind: "$items" },
    { $match: { "items.menuItemId": { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$items.menuItemId",
        qty: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { qty: -1 } },
    { $limit: limit },
  ]);

  const result = rows.map((r, idx) => ({
    menuItemId: String(r._id),
    rank: idx + 1,
    qty: r.qty,
    revenue: Math.round((r.revenue + Number.EPSILON) * 100) / 100,
    orders: r.orders,
  }));
  setCache(key, result);
  return result;
}

async function topCombosByQty({ days = 30, storeId = null, limit = 50 }) {
  const key = rangeKey("combos", days, storeId);
  const cached = getCache(key);
  if (cached) return cached;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match = {
    createdAt: { $gte: since },
    status: { $in: REVENUE_ORDER_STATUSES },
    paymentStatus: "success",
  };
  if (storeId) match.storeId = storeId;

  const rows = await Order.aggregate([
    { $match: match },
    { $unwind: "$items" },
    { $match: { "items.comboId": { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$items.comboId",
        qty: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { qty: -1 } },
    { $limit: limit },
  ]);

  const result = rows.map((r, idx) => ({
    comboId: String(r._id),
    rank: idx + 1,
    qty: r.qty,
    revenue: Math.round((r.revenue + Number.EPSILON) * 100) / 100,
    orders: r.orders,
  }));
  setCache(key, result);
  return result;
}

export async function getItemRanksMap({ days = 30, storeId = null } = {}) {
  const rows = await topItemsByQty({ days, storeId });
  const map = new Map();
  for (const r of rows) map.set(r.menuItemId, r.rank);
  return map;
}

export async function getComboRanksMap({ days = 30, storeId = null } = {}) {
  const rows = await topCombosByQty({ days, storeId });
  const map = new Map();
  for (const r of rows) map.set(r.comboId, r.rank);
  return map;
}

export async function getTopItems(opts) {
  return topItemsByQty(opts);
}

export async function getTopCombos(opts) {
  return topCombosByQty(opts);
}

export function invalidateSortCache() {
  cache.clear();
}
