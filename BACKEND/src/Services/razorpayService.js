import crypto from "crypto";
import Razorpay from "razorpay";
import { logger } from "../Utils/logger.js";
import {
  PAYMENT_PROVIDERS,
  MIN_ORDER_AMOUNT_INR,
} from "../../config/constants.js";

let client = null;

function getClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return null;
  }
  if (!client) {
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return client;
}

export function isRazorpayEnabled() {
  return Boolean(getClient());
}

export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || null;
}

/** Amount in INR rupees → paise (integer). */
export function toPaise(amountInr) {
  return Math.round(Number(amountInr) * 100);
}

/**
 * Compute Route split for a given store + subtotal.
 * Returns null if store has no active Razorpay onboarding.
 * Merchant share = (100 - commissionPercent)% of subtotal.
 * Delivery + platform fee stay with the platform.
 */
export function computeStoreSplit(store, totalAmountInr, subtotalInr) {
  const cfg = store?.razorpay;
  if (
    !cfg ||
    !cfg.linkedAccountId ||
    cfg.onboardingStatus !== "active"
  ) {
    return null;
  }
  const commissionPercent = Math.max(0, Math.min(100, Number(cfg.commissionPercent ?? 15)));
  const subtotalPaise = toPaise(subtotalInr);
  const totalPaise = toPaise(totalAmountInr);
  const merchantPaise = Math.floor(
    (subtotalPaise * (100 - commissionPercent)) / 100
  );
  if (merchantPaise <= 0 || merchantPaise >= totalPaise) return null;
  const platformPaise = totalPaise - merchantPaise;
  return {
    commissionPercent,
    linkedAccountId: cfg.linkedAccountId,
    merchantPaise,
    platformPaise,
    transfers: [
      {
        account: cfg.linkedAccountId,
        amount: merchantPaise,
        currency: "INR",
        notes: { storeId: String(store._id) },
      },
    ],
  };
}

export async function createRazorpayOrder({
  amountInr,
  receipt,
  notes = {},
  transfers = null,
}) {
  const rz = getClient();
  if (!rz) {
    return { ok: false, message: "Payment provider not configured" };
  }

  const amount = toPaise(amountInr);
  // Belt-and-braces: orderQuoteService already enforces MIN_ORDER_AMOUNT_INR,
  // but anything calling createRazorpayOrder directly must clear it too.
  // Comparing in paise avoids float drift.
  if (amount < toPaise(MIN_ORDER_AMOUNT_INR)) {
    return {
      ok: false,
      message: `Minimum order amount is ₹${MIN_ORDER_AMOUNT_INR}`,
    };
  }

  const payload = {
    amount,
    currency: "INR",
    receipt: receipt.slice(0, 40),
    notes,
  };
  if (Array.isArray(transfers) && transfers.length > 0) {
    const totalTransfer = transfers.reduce((s, t) => s + Number(t.amount || 0), 0);
    if (totalTransfer >= amount) {
      logger.warn("Razorpay transfers exceed order amount; refusing", {
        amount,
        totalTransfer,
      });
      return { ok: false, message: "Invalid split configuration" };
    }
    // Route requires partial_payment=false (Razorpay rejects transfers otherwise)
    payload.partial_payment = false;
    payload.transfers = transfers.map((t) => ({
      account: t.account,
      amount: Math.floor(Number(t.amount)),
      currency: t.currency || "INR",
      notes: t.notes || {},
      on_hold: t.on_hold ? 1 : 0,
      ...(t.on_hold_until ? { on_hold_until: t.on_hold_until } : {}),
    }));
  }

  try {
    const order = await rz.orders.create(payload);
    return {
      ok: true,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      transfers: order.transfers || null,
    };
  } catch (err) {
    logger.error("Razorpay order create failed", { error: err.message });
    return { ok: false, message: "Could not create payment order" };
  }
}

export function verifyPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpaySignature)
    );
  } catch {
    return false;
  }
}

export async function fetchAndValidatePayment({
  razorpayPaymentId,
  razorpayOrderId,
  expectedAmountInr,
}) {
  const rz = getClient();
  if (!rz) {
    return { ok: false, message: "Payment provider not configured" };
  }

  try {
    const payment = await rz.payments.fetch(razorpayPaymentId);

    if (payment.order_id !== razorpayOrderId) {
      return { ok: false, message: "Payment order mismatch" };
    }

    if (!["captured", "authorized"].includes(payment.status)) {
      return { ok: false, message: "Payment not completed" };
    }

    const expectedPaise = toPaise(expectedAmountInr);
    if (Number(payment.amount) !== expectedPaise) {
      logger.warn("Razorpay amount mismatch", {
        expectedPaise,
        actual: payment.amount,
        paymentId: razorpayPaymentId,
      });
      return { ok: false, message: "Payment amount mismatch" };
    }

    return {
      ok: true,
      payment,
      provider: PAYMENT_PROVIDERS.RAZORPAY,
    };
  } catch (err) {
    logger.error("Razorpay fetch payment failed", { error: err.message });
    return { ok: false, message: "Payment verification failed" };
  }
}

/**
 * Reconciliation: fetch the order along with its transfers.
 * Use after payment.captured webhook or at admin trigger.
 */
export async function fetchOrderTransfers(razorpayOrderId) {
  const rz = getClient();
  if (!rz) return { ok: false, message: "Payment provider not configured" };
  try {
    const order = await rz.orders.fetch(razorpayOrderId);
    let transfers = [];
    if (typeof rz.orders.fetchTransferOrder === "function") {
      transfers = await rz.orders.fetchTransferOrder(razorpayOrderId);
    } else {
      // SDK fallback: use REST direct call
      const auth = Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString("base64");
      const res = await fetch(
        `https://api.razorpay.com/v1/orders/${razorpayOrderId}/transfers`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      if (!res.ok) {
        return { ok: false, message: `Razorpay HTTP ${res.status}` };
      }
      const data = await res.json();
      transfers = data.items || data || [];
    }
    return { ok: true, order, transfers };
  } catch (err) {
    logger.error("Razorpay fetchOrderTransfers failed", { error: err.message });
    return { ok: false, message: err.message };
  }
}

export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export function getRazorpaySupportPhone() {
  return process.env.RAZORPAY_SUPPORT_PHONE || null;
}

export async function processRazorpayRefund({ paymentId, amountInr, notes = {} }) {
  const rz = getClient();
  if (!rz) {
    return { ok: false, message: "Payment provider not configured" };
  }

  try {
    const refund = await rz.payments.refund(paymentId, {
      amount: toPaise(amountInr),
      speed: "normal",
      notes,
    });

    logger.info("Razorpay refund processed", {
      paymentId,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    });

    return { ok: true, refundId: refund.id, status: refund.status };
  } catch (err) {
    logger.error("Razorpay refund failed", {
      paymentId,
      error: err.error?.description || err.message,
    });
    return {
      ok: false,
      message: err.error?.description || err.message || "Refund failed",
    };
  }
}
