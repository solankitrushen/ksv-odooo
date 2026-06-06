import Discount from "../Schema/Discount.js";
import { isDiscountActive, resolveFinalPrice } from "../Utils/priceCalculator.js";

/**
 * Active discounts that apply to menu items.
 */
export async function getActiveDiscountsForItems(itemIds = [], now = new Date()) {
  const query = {
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    applicableTo: { $in: ["items", "both"] },
  };

  if (itemIds.length) {
    query.targetItemIds = { $in: itemIds };
  }

  return Discount.find(query).lean();
}

export async function getActiveDiscountsForCombos(comboIds = [], now = new Date()) {
  const query = {
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    applicableTo: { $in: ["combos", "both"] },
  };

  if (comboIds.length) {
    query.targetComboIds = { $in: comboIds };
  }

  return Discount.find(query).lean();
}

/**
 * Map itemId string → discount rules targeting that item.
 */
export function groupDiscountsByItemId(discounts) {
  /** @type {Map<string, object[]>} */
  const map = new Map();
  for (const d of discounts) {
    for (const id of d.targetItemIds || []) {
      const key = String(id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
  }
  return map;
}

export function groupDiscountsByComboId(discounts) {
  const map = new Map();
  for (const d of discounts) {
    for (const id of d.targetComboIds || []) {
      const key = String(id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
  }
  return map;
}

export function priceWithDiscounts(basePrice, rules, now = new Date()) {
  const active = rules.filter((r) => isDiscountActive(r, now));
  return resolveFinalPrice(basePrice, active, now);
}
