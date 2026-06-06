import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import { buildOrderQuote, resolveDeliveryAddress } from "../Services/orderQuoteService.js";
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  isRazorpayEnabled,
  computeStoreSplit,
} from "../Services/razorpayService.js";
import { generateOrderNumber } from "../Services/orderService.js";
import Store from "../Schema/Store.js";

export async function createPaymentOrder(req, res) {
  if (process.env.ORDER_AUTO_PAYMENT_SUCCESS === "true") {
    return sendSuccess(res, 200, {
      mode: "test",
      message: "Payment auto-success enabled; place order without Razorpay",
      keyId: null,
    });
  }

  if (!isRazorpayEnabled()) {
    return sendError(
      res,
      503,
      "Service unavailable",
      "Payment provider not configured"
    );
  }

  const data = { ...req.validated };
  const addr = await resolveDeliveryAddress(req.userId, data);
  if (!addr.ok) {
    return sendError(res, 400, "Invalid address", addr.message);
  }

  const quote = await buildOrderQuote(data);
  if (!quote.ok) {
    return sendError(res, 400, "Validation failed", quote.message);
  }

  const receipt = generateOrderNumber();
  const store = await Store.findById(req.validated.storeId);
  const split = store
    ? computeStoreSplit(store, quote.totalAmount, quote.subtotal)
    : null;

  const rz = await createRazorpayOrder({
    amountInr: quote.totalAmount,
    receipt,
    notes: {
      userId: String(req.userId),
      storeId: String(req.validated.storeId),
      deliveryType: req.validated.deliveryType,
      ...(split
        ? {
            split: "1",
            commission: String(split.commissionPercent),
          }
        : {}),
    },
    transfers: split?.transfers || null,
  });

  if (!rz.ok) {
    return sendError(res, 502, "Payment error", rz.message);
  }

  return sendSuccess(res, 200, {
    keyId: getRazorpayKeyId(),
    razorpayOrderId: rz.razorpayOrderId,
    amount: rz.amount,
    currency: rz.currency,
    quote: {
      subtotal: quote.subtotal,
      deliveryCharge: quote.deliveryCharge,
      deliveryDistanceKm: quote.deliveryDistanceKm,
      platformFee: quote.platformFee,
      platformFeePercent: quote.platformFeePercent,
      totalAmount: quote.totalAmount,
      minOrderValue: quote.minOrderValue,
      freeDeliveryThreshold: quote.freeDeliveryThreshold,
      deliveryFee: quote.deliveryFee,
      amountToFreeDelivery: quote.amountToFreeDelivery,
    },
    split: split
      ? {
          enabled: true,
          commissionPercent: split.commissionPercent,
          merchantPaise: split.merchantPaise,
          platformPaise: split.platformPaise,
        }
      : { enabled: false },
  });
}
