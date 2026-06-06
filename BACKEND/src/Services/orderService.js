import MenuItem from "../Schema/MenuItem.js";
import Combo from "../Schema/Combo.js";
import Store from "../Schema/Store.js";
import {
  getActiveDiscountsForItems,
  getActiveDiscountsForCombos,
  groupDiscountsByItemId,
  groupDiscountsByComboId,
  priceWithDiscounts,
} from "./discountService.js";
import { comboIsAvailable } from "./comboService.js";
import { roundMoney } from "../Utils/priceCalculator.js";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  DELIVERY_FREE_KM,
  DELIVERY_RATE_PER_KM,
} from "../../config/constants.js";

export function generateOrderNumber() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now()}-${suffix}`;
}

export function calculateDeliveryCharge(deliveryType, distanceKm = 0) {
  if (deliveryType !== "delivery") return 0;
  const km = Math.max(0, Number(distanceKm) || 0);
  if (km <= DELIVERY_FREE_KM) return 0;
  return roundMoney((km - DELIVERY_FREE_KM) * DELIVERY_RATE_PER_KM);
}

export async function resolveOrderLines(lineInputs) {
  const menuIds = lineInputs
    .filter((l) => l.menuItemId)
    .map((l) => l.menuItemId);
  const comboIds = lineInputs.filter((l) => l.comboId).map((l) => l.comboId);

  const menuItems = menuIds.length
    ? await MenuItem.find({ _id: { $in: menuIds }, isActive: true })
    : [];
  const combos = comboIds.length
    ? await Combo.find({ _id: { $in: comboIds }, isActive: true })
    : [];

  if (menuItems.length !== menuIds.length) {
    return { ok: false, message: "One or more menu items unavailable" };
  }

  const itemDiscounts = await getActiveDiscountsForItems(menuIds);
  const comboDiscounts = await getActiveDiscountsForCombos(comboIds);
  const byItem = groupDiscountsByItemId(itemDiscounts);
  const byCombo = groupDiscountsByComboId(comboDiscounts);

  const lines = [];

  for (const input of lineInputs) {
    if (input.menuItemId) {
      const item = menuItems.find(
        (m) => String(m._id) === String(input.menuItemId)
      );
      const pricing = priceWithDiscounts(
        item.price,
        byItem.get(String(item._id)) || []
      );
      const unitPrice = pricing.appliedPrice;
      lines.push({
        menuItemId: item._id,
        name: item.name,
        quantity: input.quantity,
        unitPrice,
        lineTotal: roundMoney(unitPrice * input.quantity),
      });
    } else if (input.comboId) {
      const combo = combos.find((c) => String(c._id) === String(input.comboId));
      if (!combo) {
        return { ok: false, message: "Combo unavailable" };
      }
      if (!(await comboIsAvailable(combo))) {
        return { ok: false, message: `Combo "${combo.name}" unavailable` };
      }
      const pricing = priceWithDiscounts(
        combo.comboPrice,
        byCombo.get(String(combo._id)) || []
      );
      const unitPrice = pricing.appliedPrice;
      lines.push({
        comboId: combo._id,
        name: combo.name,
        quantity: input.quantity,
        unitPrice,
        lineTotal: roundMoney(unitPrice * input.quantity),
      });
    }
  }

  return { ok: true, lines };
}

export function sumLineTotals(lines) {
  return roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
}

export async function assertStoreActive(storeId) {
  const store = await Store.findById(storeId);
  if (!store || !store.isActive) {
    return { ok: false, message: "Store not found or inactive" };
  }
  return { ok: true, store };
}

export function pushStatusHistory(order, status, byRole, byId, note = null) {
  order.status = status;
  order.statusHistory.push({
    status,
    at: new Date(),
    byRole,
    byId,
    note,
  });
}

const STORE_TRANSITIONS = {
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PREPARING],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY],
  [ORDER_STATUS.READY]: [ORDER_STATUS.IN_DELIVERY, ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.IN_DELIVERY]: [ORDER_STATUS.DELIVERED],
};

export function canStoreTransition(from, to, deliveryType = "takeaway") {
  if (from === ORDER_STATUS.READY && to === ORDER_STATUS.DELIVERED) {
    return deliveryType === "takeaway";
  }
  if (from === ORDER_STATUS.READY && to === ORDER_STATUS.IN_DELIVERY) {
    return deliveryType === "delivery";
  }
  return STORE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status) {
  return (
    status === ORDER_STATUS.REJECTED ||
    status === ORDER_STATUS.DELIVERED ||
    status === ORDER_STATUS.CANCELLED
  );
}

export function resolvePaymentStatusOnCreate() {
  if (process.env.ORDER_AUTO_PAYMENT_SUCCESS === "true") {
    return PAYMENT_STATUS.SUCCESS;
  }
  return PAYMENT_STATUS.PENDING;
}

export function canAcceptOrder(order) {
  if (order.status !== ORDER_STATUS.PENDING) {
    return { ok: false, message: "Only pending orders can be accepted" };
  }
  if (order.paymentStatus !== PAYMENT_STATUS.SUCCESS) {
    return {
      ok: false,
      message: "Payment must be successful before acceptance",
    };
  }
  return { ok: true };
}
