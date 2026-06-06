import Order from "../Schema/Order.js";
import User from "../Schema/User.js";
import {
  assertStoreActive,
  resolveOrderLines,
  sumLineTotals,
} from "./orderService.js";
import {
  haversineKm,
  isValidLatitude,
  isValidLongitude,
  roundKm,
} from "../Utils/geo.js";
import { ORDERING_DEFAULTS } from "../../config/constants.js";

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Merge a store's ordering config over the platform defaults. */
export function resolveOrdering(store) {
  const o = store?.ordering || {};
  return {
    minOrderValue: num(o.minOrderValue, ORDERING_DEFAULTS.minOrderValue),
    freeDeliveryThreshold: num(o.freeDeliveryThreshold, ORDERING_DEFAULTS.freeDeliveryThreshold),
    deliveryFee: num(o.deliveryFee, ORDERING_DEFAULTS.deliveryFee),
    freeRadiusKm: num(o.freeRadiusKm, ORDERING_DEFAULTS.freeRadiusKm),
    maxRadiusKm: num(o.maxRadiusKm, ORDERING_DEFAULTS.maxRadiusKm),
    perKmFee: num(o.perKmFee, ORDERING_DEFAULTS.perKmFee),
  };
}

/**
 * Delivery charge from store config: free within freeRadiusKm when subtotal meets
 * the free-delivery threshold, else the flat deliveryFee; plus per-km beyond the
 * free radius (only reachable when maxRadiusKm > freeRadiusKm).
 */
function computeDeliveryCharge(ordering, deliveryType, subtotal, distanceKm) {
  if (deliveryType !== "delivery") return 0;
  let charge = subtotal >= ordering.freeDeliveryThreshold ? 0 : ordering.deliveryFee;
  const km = Math.max(0, Number(distanceKm) || 0);
  if (km > ordering.freeRadiusKm) {
    charge += (km - ordering.freeRadiusKm) * ordering.perKmFee;
  }
  return +charge.toFixed(2);
}

export async function validateDeliveryForStore(
  store,
  deliveryType,
  deliveryLatitude,
  deliveryLongitude
) {
  if (deliveryType !== "delivery") {
    return { ok: true, deliveryDistanceKm: 0 };
  }

  if (!isValidLatitude(deliveryLatitude) || !isValidLongitude(deliveryLongitude)) {
    return {
      ok: false,
      message: "Delivery orders require valid deliveryLatitude and deliveryLongitude",
    };
  }

  const slat = store.location?.latitude;
  const slng = store.location?.longitude;
  if (slat == null || slng == null) {
    return {
      ok: false,
      message: "Store delivery location is not configured",
    };
  }

  const distanceKm = haversineKm(
    slat,
    slng,
    deliveryLatitude,
    deliveryLongitude
  );

  if (!Number.isFinite(distanceKm)) {
    return { ok: false, message: "Invalid delivery coordinates" };
  }

  const maxKm = resolveOrdering(store).maxRadiusKm;
  if (distanceKm > maxKm) {
    return {
      ok: false,
      message: `Delivery address is beyond ${maxKm} km radius`,
      distanceKm: roundKm(distanceKm),
    };
  }

  return { ok: true, deliveryDistanceKm: roundKm(distanceKm) };
}

export async function buildOrderQuote(body) {
  const {
    storeId,
    deliveryType,
    deliveryLatitude,
    deliveryLongitude,
    deliveryDistanceKm: clientDistance,
    items,
  } = body;

  const storeCheck = await assertStoreActive(storeId);
  if (!storeCheck.ok) {
    return { ok: false, message: storeCheck.message };
  }

  const deliveryCheck = await validateDeliveryForStore(
    storeCheck.store,
    deliveryType,
    deliveryLatitude,
    deliveryLongitude
  );
  if (!deliveryCheck.ok) {
    return deliveryCheck;
  }

  const linesResult = await resolveOrderLines(items);
  if (!linesResult.ok) {
    return linesResult;
  }

  const subtotal = sumLineTotals(linesResult.lines);

  // Defence in depth: subtotal must be a positive number. Catches
  // resolveOrderLines() returning a zero line (e.g. a free item slipping
  // past validation) before any payment provider is touched.
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return { ok: false, message: "Cart subtotal is invalid" };
  }

  const ordering = resolveOrdering(storeCheck.store);

  // Hard floor enforced server-side. Razorpay is never called for orders
  // below the store minimum, so a tampered client cannot bypass this by
  // editing local state or skipping the storefront UI.
  if (subtotal < ordering.minOrderValue) {
    return {
      ok: false,
      message: `Minimum order amount is ₹${ordering.minOrderValue}`,
      code: "MIN_ORDER_NOT_MET",
      minOrderAmount: ordering.minOrderValue,
      amountToMinOrder: +(ordering.minOrderValue - subtotal).toFixed(2),
      subtotal,
    };
  }

  const deliveryDistanceKm =
    deliveryType === "delivery"
      ? deliveryCheck.deliveryDistanceKm
      : clientDistance || 0;
  const deliveryCharge = computeDeliveryCharge(
    ordering,
    deliveryType,
    subtotal,
    deliveryDistanceKm
  );

  // Platform fee: customer-visible add-on equal to the store's
  // razorpay.commissionPercent (default 15%). This is the *only* place
  // the fee is added to the customer's bill. Keep it derived from the
  // store on every quote so an admin update applies to the next order.
  const commissionPercent = Math.max(
    0,
    Math.min(100, Number(storeCheck.store?.razorpay?.commissionPercent ?? 15)),
  );
  const platformFee = +((subtotal * commissionPercent) / 100).toFixed(2);

  const totalAmount = +(subtotal + deliveryCharge + platformFee).toFixed(2);

  return {
    ok: true,
    store: storeCheck.store,
    lines: linesResult.lines,
    subtotal,
    deliveryDistanceKm,
    deliveryCharge,
    platformFee,
    platformFeePercent: commissionPercent,
    totalAmount,
    minOrderValue: ordering.minOrderValue,
    freeDeliveryThreshold: ordering.freeDeliveryThreshold,
    deliveryFee: ordering.deliveryFee,
    freeRadiusKm: ordering.freeRadiusKm,
    amountToFreeDelivery: +Math.max(0, ordering.freeDeliveryThreshold - subtotal).toFixed(2),
  };
}

export async function assertPaymentNotReused(paymentReference) {
  if (!paymentReference) return { ok: true };
  const existing = await Order.findOne({ paymentReference }).select("_id");
  if (existing) {
    return { ok: false, message: "Payment already linked to another order" };
  }
  return { ok: true };
}

/**
 * Resolve a saved delivery address to coordinates on the request body.
 * Mutates `data` (sets deliveryLatitude/Longitude). Shared by the payment
 * quote and order-create paths so both compute distance from the same point.
 */
export async function resolveDeliveryAddress(userId, data) {
  if (data.deliveryAddressId && data.deliveryType === "delivery") {
    const user = await User.findById(userId).select("addresses");
    const addr = user?.addresses?.find(
      (a) => String(a._id) === data.deliveryAddressId
    );
    if (!addr) {
      return { ok: false, message: "Delivery address not found" };
    }
    if (addr.latitude != null && addr.longitude != null) {
      data.deliveryLatitude = addr.latitude;
      data.deliveryLongitude = addr.longitude;
    }
  }
  return { ok: true };
}

/** etaAt = acceptedAt + preparationMinutes (null until accepted with a prep time). */
export function computeEtaAt(order) {
  if (!order?.acceptedAt || !order?.preparationMinutes) return null;
  return new Date(
    new Date(order.acceptedAt).getTime() + order.preparationMinutes * 60_000
  );
}
