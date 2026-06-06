import MenuItem from "../Schema/MenuItem.js";
import Combo from "../Schema/Combo.js";
import Store from "../Schema/Store.js";
import {
  getActiveDiscountsForItems,
  getActiveDiscountsForCombos,
  groupDiscountsByItemId,
  groupDiscountsByComboId,
  priceWithDiscounts,
} from "../Services/discountService.js";
import { comboIsAvailable } from "../Services/comboService.js";
import { getTopItems } from "../Services/inventorySortService.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  DELIVERY_MAX_KM,
  MIN_ORDER_AMOUNT_INR,
  ORDERING_DEFAULTS,
} from "../../config/constants.js";

export async function getPublicStores(req, res) {
  const stores = await Store.find({ isActive: true })
    .sort({ createdAt: 1 })
    .lean();

  return sendSuccess(res, 200, {
    stores: stores.map((store) => ({
      id: store._id,
      name: store.name,
      phone: store.phone,
      address: store.address || null,
      location: {
        latitude: store.location?.latitude ?? null,
        longitude: store.location?.longitude ?? null,
      },
      cuisineTypes: store.cuisineTypes || [],
      deliveryRadiusKm: DELIVERY_MAX_KM,
      ordering: {
        minOrderValue: store.ordering?.minOrderValue ?? ORDERING_DEFAULTS.minOrderValue,
        freeDeliveryThreshold:
          store.ordering?.freeDeliveryThreshold ?? ORDERING_DEFAULTS.freeDeliveryThreshold,
        deliveryFee: store.ordering?.deliveryFee ?? ORDERING_DEFAULTS.deliveryFee,
        freeRadiusKm: store.ordering?.freeRadiusKm ?? ORDERING_DEFAULTS.freeRadiusKm,
        maxRadiusKm: store.ordering?.maxRadiusKm ?? ORDERING_DEFAULTS.maxRadiusKm,
        perKmFee: store.ordering?.perKmFee ?? ORDERING_DEFAULTS.perKmFee,
      },
      // Surface the same fee the backend will charge so the cart can
      // render an accurate breakdown before checkout. Capped 0–100.
      platformFeePercent: Math.max(
        0,
        Math.min(100, Number(store.razorpay?.commissionPercent ?? 15)),
      ),
      minOrderAmount: store.ordering?.minOrderValue ?? MIN_ORDER_AMOUNT_INR,
      isOpen: store.subscriptionStatus === "active" && store.isActive,
    })),
  });
}

export async function getPublicMenu(req, res) {
  const items = await MenuItem.find({ isActive: true })
    .sort({ category: 1, name: 1 })
    .lean();

  const ids = items.map((i) => i._id);
  const discounts = await getActiveDiscountsForItems(ids);
  const byItem = groupDiscountsByItemId(discounts);

  const menu = items.map((item) => {
    const rules = byItem.get(String(item._id)) || [];
    const pricing = priceWithDiscounts(item.price, rules);
    return {
      id: item._id,
      name: item.name,
      description: item.description,
      category: item.category,
      tags: item.tags || [],
      imagePath: item.imagePath,
      imageUrl: item.imageUrl || item.imagePath,
      ...pricing,
    };
  });

  return sendSuccess(res, 200, { menu });
}

export async function getPublicCombos(req, res) {
  const combos = await Combo.find({ isActive: true }).lean();
  const available = [];

  for (const combo of combos) {
    if (!(await comboIsAvailable(combo))) continue;
    available.push(combo);
  }

  const ids = available.map((c) => c._id);
  const discounts = await getActiveDiscountsForCombos(ids);
  const byCombo = groupDiscountsByComboId(discounts);

  const result = available.map((combo) => {
    const rules = byCombo.get(String(combo._id)) || [];
    const pricing = priceWithDiscounts(combo.comboPrice, rules);
    return {
      id: combo._id,
      name: combo.name,
      description: combo.description,
      items: combo.items,
      ...pricing,
    };
  });

  return sendSuccess(res, 200, { combos: result });
}

async function buildRankedItems(days, limit) {
  const ranks = await getTopItems({ days, limit });
  if (!ranks.length) return [];

  const ids = ranks.map((r) => r.menuItemId);
  const items = await MenuItem.find({
    _id: { $in: ids },
    isActive: true,
  }).lean();
  const byId = new Map(items.map((i) => [String(i._id), i]));

  const discounts = await getActiveDiscountsForItems(ids);
  const byItem = groupDiscountsByItemId(discounts);

  return ranks
    .map((r) => {
      const item = byId.get(r.menuItemId);
      if (!item) return null;
      const rules = byItem.get(r.menuItemId) || [];
      const pricing = priceWithDiscounts(item.price, rules);
      return {
        id: item._id,
        name: item.name,
        description: item.description,
        category: item.category,
        tags: item.tags || [],
        imagePath: item.imagePath,
        imageUrl: item.imageUrl || item.imagePath,
        qty: r.qty,
        orderCount: r.orders,
        rank: r.rank,
        ...pricing,
      };
    })
    .filter(Boolean);
}

export async function getTrendingItems(req, res) {
  const items = await buildRankedItems(7, 10);
  return sendSuccess(res, 200, { items });
}

export async function getMostPurchasedItems(req, res) {
  const items = await buildRankedItems(30, 10);
  return sendSuccess(res, 200, { items });
}
