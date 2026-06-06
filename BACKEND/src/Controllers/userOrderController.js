import Order from "../Schema/Order.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  generateOrderNumber,
  pushStatusHistory,
  resolvePaymentStatusOnCreate,
} from "../Services/orderService.js";
import { ORDER_STATUS, PAYMENT_PROVIDERS } from "../../config/constants.js";
import { buildOrderQuote, assertPaymentNotReused, resolveDeliveryAddress, computeEtaAt } from "../Services/orderQuoteService.js";
import {
  reserveMenuStock,
  releaseMenuStock,
  releaseOrderStock,
} from "../Services/inventoryService.js";
import {
  fetchAndValidatePayment,
  verifyPaymentSignature,
  computeStoreSplit,
} from "../Services/razorpayService.js";
import { getRefundTicket, createRefundTicket, processRefund } from "../Services/refundService.js";
import Store from "../Schema/Store.js";
import {
  generateDeliveryOtp,
  hashDeliveryOtp,
} from "../Utils/deliveryOtp.js";

function formatOrder(order, { deliveryOtp = null } = {}) {
  const o = order.toObject ? order.toObject() : order;
  const out = {
    id: o._id,
    orderNumber: o.orderNumber,
    storeId: o.storeId,
    status: o.status,
    deliveryType: o.deliveryType,
    deliveryDistanceKm: o.deliveryDistanceKm,
    acceptedAt: o.acceptedAt || null,
    preparationMinutes: o.preparationMinutes || null,
    etaAt: computeEtaAt(o),
    deliveryCharge: o.deliveryCharge,
    subtotal: o.subtotal,
    platformFee: o.platformFee,
    platformFeePercent: o.platformFeePercent,
    totalAmount: o.totalAmount,
    items: o.items,
    userNote: o.userNote,
    paymentStatus: o.paymentStatus,
    rejectReason: o.rejectReason,
    prepNotes: o.prepNotes,
    storeMessages: o.storeMessages,
    statusHistory: o.statusHistory,
    deliveryProofImageUrl: o.deliveryProofImageUrl,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
  if (deliveryOtp) {
    out.deliveryOtp = deliveryOtp;
  }
  return out;
}

async function resolveVerifiedPayment(data, userId, totalAmount) {
  if (process.env.ORDER_AUTO_PAYMENT_SUCCESS === "true") {
    const { randomUUID } = await import("crypto");
    return {
      ok: true,
      paymentStatus: "success",
      paymentProvider: PAYMENT_PROVIDERS.TEST,
      paymentReference: `test-${userId}-${randomUUID()}`,
      razorpayOrderId: null,
      paymentVerifiedAt: new Date(),
    };
  }

  const {
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
  } = data;

  if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    return { ok: false, message: "Payment verification required" };
  }

  const reuse = await assertPaymentNotReused(razorpayPaymentId);
  if (!reuse.ok) {
    return reuse;
  }

  if (
    !verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    })
  ) {
    return { ok: false, message: "Invalid payment signature" };
  }

  const verified = await fetchAndValidatePayment({
    razorpayPaymentId,
    razorpayOrderId,
    expectedAmountInr: totalAmount,
  });

  if (!verified.ok) {
    return verified;
  }

  return {
    ok: true,
    paymentStatus: "success",
    paymentProvider: PAYMENT_PROVIDERS.RAZORPAY,
    paymentReference: razorpayPaymentId,
    razorpayOrderId,
    paymentVerifiedAt: new Date(),
  };
}

export async function createOrder(req, res) {
  const data = { ...req.validated };

  // Resolve delivery coords from saved address if deliveryAddressId is provided.
  const addr = await resolveDeliveryAddress(req.userId, data);
  if (!addr.ok) {
    return sendError(res, 400, "Invalid address", addr.message);
  }

  const quote = await buildOrderQuote(data);
  if (!quote.ok) {
    return sendError(res, 400, "Validation failed", quote.message);
  }

  const payment = await resolveVerifiedPayment(data, req.userId, quote.totalAmount);
  if (!payment.ok) {
    return sendError(res, 400, "Payment failed", payment.message);
  }

  const stock = await reserveMenuStock(quote.lines);
  if (!stock.ok) {
    return sendError(res, 400, "Out of stock", stock.message);
  }

  const splitStore = await Store.findById(data.storeId);
  const split = splitStore
    ? computeStoreSplit(splitStore, quote.totalAmount, quote.subtotal)
    : null;

  let deliveryOtpPlain = null;
  let deliveryOtpHash = null;
  if (data.deliveryType === "delivery") {
    deliveryOtpPlain = generateDeliveryOtp();
    deliveryOtpHash = hashDeliveryOtp(deliveryOtpPlain);
  }

  try {
    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      userId: req.userId,
      storeId: data.storeId,
      deliveryType: data.deliveryType,
      deliveryDistanceKm: quote.deliveryDistanceKm,
      deliveryLatitude: data.deliveryLatitude ?? null,
      deliveryLongitude: data.deliveryLongitude ?? null,
      deliveryCharge: quote.deliveryCharge,
      subtotal: quote.subtotal,
      platformFee: quote.platformFee,
      platformFeePercent: quote.platformFeePercent,
      totalAmount: quote.totalAmount,
      items: quote.lines,
      userNote: data.userNote,
      paymentStatus: payment.paymentStatus || resolvePaymentStatusOnCreate(),
      paymentProvider: payment.paymentProvider,
      paymentReference: payment.paymentReference,
      razorpayOrderId: payment.razorpayOrderId,
      paymentVerifiedAt: payment.paymentVerifiedAt,
      payout: split
        ? {
            merchantAmount: split.merchantPaise,
            platformAmount: split.platformPaise,
            linkedAccountId: split.linkedAccountId,
            commissionPercent: split.commissionPercent,
            transferId: null,
          }
        : undefined,
      deliveryOtpHash,
      deliveryOtp: deliveryOtpPlain,
      statusHistory: [
        {
          status: ORDER_STATUS.PENDING,
          at: new Date(),
          byRole: "user",
          byId: req.userId,
          note: "Order placed",
        },
      ],
    });

    // Delivery OTP is delivered out-of-band (email / SMS / console),
    // never echoed in the order response in production — that would
    // leak it into browser dev tools, request logs and shared
    // screenshots. Test runs and explicit `console` channel keep the
    // echo for fixture-driven flows.
    const channel = process.env.DELIVERY_OTP_DELIVERY_CHANNEL || "console";
    const isProd = process.env.NODE_ENV === "production";
    const echoOtp =
      !isProd && (channel === "console" || process.env.NODE_ENV === "test");

    if (deliveryOtpPlain && !isProd) {
      console.log(
        `[delivery-otp] order=${order.orderNumber} otp=${deliveryOtpPlain}`
      );
    }

    return sendSuccess(res, 201, {
      order: formatOrder(order, {
        deliveryOtp: echoOtp ? deliveryOtpPlain : null,
      }),
    });
  } catch (err) {
    await releaseMenuStock(stock.reserved);
    throw err;
  }
}

export async function listUserOrders(req, res) {
  const { status, limit } = req.validatedQuery || { limit: 20 };
  const filter = { userId: req.userId };
  if (status) filter.status = status;

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit);

  const results = orders.map((o) => formatOrder(o));

  const rejectedOrderIds = orders
    .filter((o) => o.status === ORDER_STATUS.REJECTED)
    .map((o) => o._id);

  if (rejectedOrderIds.length > 0) {
    const RefundTicket = (await import("../Schema/RefundTicket.js")).default;
    const tickets = await RefundTicket.find({
      orderId: { $in: rejectedOrderIds },
    }).lean();

    const ticketMap = new Map();
    for (const t of tickets) {
      ticketMap.set(String(t.orderId), {
        id: String(t._id),
        status: t.status,
        supportPhone: t.supportPhone,
      });
    }

    for (const r of results) {
      const t = ticketMap.get(String(r.id));
      if (t) r.refund = t;
    }
  }

  return sendSuccess(res, 200, { orders: results });
}

export async function getUserOrder(req, res) {
  const order = await Order.findOne({
    _id: req.params.id,
    userId: req.userId,
  }).select("+deliveryOtp");

  if (!order) {
    return sendError(res, 404, "Not found", "Order not found");
  }

  const otpActive =
    order.deliveryType === "delivery" &&
    ![
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.REJECTED,
    ].includes(order.status);

  const payload = formatOrder(order, {
    deliveryOtp: otpActive ? order.deliveryOtp : null,
  });
  if (otpActive) {
    payload.deliveryOtpHint =
      "Share this OTP with staff when they arrive with your order";
  }

  if (order.status === ORDER_STATUS.REJECTED) {
    const refundTicket = await getRefundTicket(order._id);
    if (refundTicket) {
      payload.refund = refundTicket;
    }
  }

  return sendSuccess(res, 200, { order: payload });
}

// User-initiated cancel — only while the store hasn't accepted (pending).
// Orders are created already-paid in this flow, so a paid cancel triggers the
// same refund pipeline as a store reject (idempotent, one ticket per order).
export async function cancelOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
  if (!order) {
    return sendError(res, 404, "Not found", "Order not found");
  }
  if (order.status !== ORDER_STATUS.PENDING) {
    return sendError(
      res,
      400,
      "Invalid state",
      "This order can no longer be cancelled"
    );
  }

  const reason = req.validated?.reason?.trim() || "Cancelled by customer";

  const saved = await Order.findOneAndUpdate(
    {
      _id: order._id,
      userId: req.userId,
      status: ORDER_STATUS.PENDING,
      version: order.version,
    },
    {
      $set: { status: ORDER_STATUS.CANCELLED, rejectReason: reason },
      $inc: { version: 1 },
      $push: {
        statusHistory: {
          status: ORDER_STATUS.CANCELLED,
          at: new Date(),
          byRole: "user",
          byId: req.userId,
          note: reason,
        },
      },
    },
    { new: true }
  );

  if (!saved) {
    return sendError(res, 409, "Conflict", "Order was updated concurrently");
  }

  await releaseOrderStock(saved);

  if (saved.paymentStatus === "success" && saved.paymentReference) {
    const refund = await createRefundTicket({
      orderId: saved._id,
      userId: saved.userId,
      storeId: saved.storeId,
      amount: saved.totalAmount,
      reason,
      paymentReference: saved.paymentReference,
      paymentProvider: saved.paymentProvider,
    });
    if (refund.ok && !refund.existed) {
      processRefund({
        orderId: saved._id,
        paymentReference: saved.paymentReference,
        amount: saved.totalAmount,
        provider: saved.paymentProvider,
      }).catch((err) => console.error("[cancel-refund] background failed", err));
    }
  }

  const payload = formatOrder(saved);
  const ticket = await getRefundTicket(saved._id);
  if (ticket) payload.refund = ticket;
  return sendSuccess(res, 200, { order: payload });
}
