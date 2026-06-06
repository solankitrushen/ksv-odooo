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
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { DELIVERY_MAX_KM } from "../../config/constants.js";

export async function getUserMenu(req, res) {
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
      ...pricing,
    };
  });

  return sendSuccess(res, 200, { menu });
}

export async function getUserStore(req, res) {
  // Single-tenant: the customer app talks to one cafe. Expose only the
  // public-safe fields the app needs to build orders (id, location, radius).
  const store = await Store.findOne({ isActive: true })
    .sort({ createdAt: 1 })
    .lean();

  if (!store) {
    return sendError(res, 404, "Not found", "No active store configured");
  }

  return sendSuccess(res, 200, {
    store: {
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
      isOpen: store.subscriptionStatus === "active" && store.isActive,
    },
  });
}

export async function getUserCombos(req, res) {
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
