import Order from "../Schema/Order.js";
import { sendError, sendSuccess } from "../Utils/errorResponse.js";
import {
  canAcceptOrder,
  canStoreTransition,
  isTerminalStatus,
} from "../Services/orderService.js";
import { ORDER_STATUS } from "../../config/constants.js";
import { computeEtaAt } from "../Services/orderQuoteService.js";
import {
  releaseOrderStock,
  consumeOrderStock,
} from "../Services/inventoryService.js";
import {
  createRefundTicket,
  processRefund,
} from "../Services/refundService.js";
import { verifyDeliveryOtp } from "../Utils/deliveryOtp.js";
import { isCloudinaryEnabled, uploadImageBuffer } from "../Services/cloudinaryService.js";
import { getRefundTicket } from "../Services/refundService.js";
import { onStoreOrderUpdate } from "../Utils/orderEvents.js";

function formatOrder(order) {
  const o = order.toObject ? order.toObject() : order;
  return {
    id: o._id,
    orderNumber: o.orderNumber,
    userId: o.userId,
    storeId: o.storeId,
    status: o.status,
    deliveryType: o.deliveryType,
    acceptedAt: o.acceptedAt || null,
    preparationMinutes: o.preparationMinutes || null,
    etaAt: computeEtaAt(o),
    deliveryCharge: o.deliveryCharge,
    subtotal: o.subtotal,
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
}

async function loadStoreOrder(req, res) {
  const order = await Order.findOne({
    _id: req.params.id,
    storeId: req.userId,
  });

  if (!order) {
    sendError(res, 404, "Not found", "Order not found");
    return null;
  }
  return order;
}

function historyEntry(status, byId, note) {
  return {
    status,
    at: new Date(),
    byRole: "store",
    byId,
    note: note || null,
  };
}

export async function listStoreOrders(req, res) {  const { status, limit } = req.validatedQuery || { limit: 20 };
  const filter = { storeId: req.userId };
  if (status) filter.status = status;

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit);

  return sendSuccess(res, 200, {
    orders: orders.map(formatOrder),
  });
}

export async function getStoreOrder(req, res) {
  const order = await loadStoreOrder(req, res);
  if (!order) return;
  const payload = formatOrder(order);
  if (order.status === ORDER_STATUS.REJECTED) {
    const ticket = await getRefundTicket(order._id);
    if (ticket) payload.refund = ticket;
  }
  return sendSuccess(res, 200, { order: payload });
}

export async function acceptOrder(req, res) {
  const order = await loadStoreOrder(req, res);
  if (!order) return;

  const check = canAcceptOrder(order);
  if (!check.ok) {
    return sendError(res, 400, "Invalid state", check.message);
  }

  const prepMinutes = req.validated?.preparationMinutes ?? 30;
  const acceptedAt = new Date();

  const saved = await Order.findOneAndUpdate(
    {
      _id: order._id,
      storeId: req.userId,
      status: ORDER_STATUS.PENDING,
      version: order.version,
    },
    {
      $set: {
        status: ORDER_STATUS.ACCEPTED,
        acceptedAt,
        preparationMinutes: prepMinutes,
      },
      $inc: { version: 1 },
      $push: {
        statusHistory: historyEntry(
          ORDER_STATUS.ACCEPTED,
          req.userId,
          `Order accepted · ETA ${prepMinutes} min`
        ),
      },
    },
    { new: true }
  );

  if (!saved) {
    return sendError(
      res,
      409,
      "Conflict",
      "Order was updated by another request"
    );
  }

  return sendSuccess(res, 200, { order: formatOrder(saved) });
}

export async function rejectOrder(req, res) {
  const order = await loadStoreOrder(req, res);
  if (!order) return;

  if (order.status !== ORDER_STATUS.PENDING) {
    return sendError(
      res,
      400,
      "Invalid state",
      "Only pending orders can be rejected"
    );
  }

  const { reason } = req.validated;

  const saved = await Order.findOneAndUpdate(
    {
      _id: order._id,
      storeId: req.userId,
      status: ORDER_STATUS.PENDING,
      version: order.version,
    },
    {
      $set: { status: ORDER_STATUS.REJECTED, rejectReason: reason },
      $inc: { version: 1 },
      $push: {
        statusHistory: historyEntry(ORDER_STATUS.REJECTED, req.userId, reason),
        storeMessages: {
          type: "feedback",
          message: reason,
          createdAt: new Date(),
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
      }).catch((err) => {
        console.error("[refund] background process failed", err);
      });
    }
  }

  return sendSuccess(res, 200, { order: formatOrder(saved) });
}

export async function updateOrderStatus(req, res) {
  const order = await loadStoreOrder(req, res);
  if (!order) return;

  const { status, note } = req.validated;

  if (isTerminalStatus(order.status)) {
    return sendError(res, 400, "Invalid state", "Order is in a terminal state");
  }

  if (!canStoreTransition(order.status, status, order.deliveryType)) {
    return sendError(
      res,
      400,
      "Invalid transition",
      `Cannot move from ${order.status} to ${status}`
    );
  }

  if (
    status === ORDER_STATUS.DELIVERED &&
    order.deliveryType === "delivery"
  ) {
    return sendError(
      res,
      400,
      "Invalid transition",
      "Use complete-delivery with OTP for delivery orders"
    );
  }

  const saved = await Order.findOneAndUpdate(
    {
      _id: order._id,
      storeId: req.userId,
      status: order.status,
      version: order.version,
    },
    {
      $set: { status },
      $inc: { version: 1 },
      $push: {
        statusHistory: historyEntry(status, req.userId, note || null),
      },
    },
    { new: true }
  );

  if (!saved) {
    return sendError(res, 409, "Conflict", "Order was updated concurrently");
  }

  if (status === ORDER_STATUS.DELIVERED) {
    await consumeOrderStock(saved);
  }

  return sendSuccess(res, 200, { order: formatOrder(saved) });
}

export async function completeDelivery(req, res) {
  const order = await loadStoreOrder(req, res);
  if (!order) return;

  if (order.deliveryType !== "delivery") {
    return sendError(
      res,
      400,
      "Invalid state",
      "Only delivery orders use OTP handover"
    );
  }

  if (
    order.status !== ORDER_STATUS.IN_DELIVERY &&
    order.status !== ORDER_STATUS.READY
  ) {
    return sendError(
      res,
      400,
      "Invalid state",
      "Order must be ready or in_delivery"
    );
  }

  const orderWithOtp = await Order.findById(order._id).select(
    "+deliveryOtpHash"
  );
  if (!verifyDeliveryOtp(req.validated.otp, orderWithOtp?.deliveryOtpHash)) {
    return sendError(res, 400, "Invalid OTP", "Delivery OTP is incorrect");
  }

  let proofUrl = req.validated.proofImageUrl;
  if (req.file?.buffer) {
    if (!isCloudinaryEnabled()) {
      return sendError(
        res,
        503,
        "Service unavailable",
        "Image upload not configured"
      );
    }
    proofUrl = await uploadImageBuffer(req.file.buffer, {
      folder: "instacafe/delivery-proof",
      mimetype: req.file.mimetype,
    });
    if (!proofUrl) {
      return sendError(res, 500, "Upload failed", "Could not upload proof image");
    }
  }

  if (!proofUrl) {
    return sendError(
      res,
      400,
      "Validation failed",
      "proofImageUrl or image file required"
    );
  }

  const saved = await Order.findOneAndUpdate(
    {
      _id: order._id,
      storeId: req.userId,
      status: order.status,
      version: order.version,
    },
    {
      $set: {
        status: ORDER_STATUS.DELIVERED,
        deliveryProofImageUrl: proofUrl,
      },
      $inc: { version: 1 },
      $push: {
        statusHistory: historyEntry(
          ORDER_STATUS.DELIVERED,
          req.userId,
          "Delivered with OTP verification"
        ),
      },
    },
    { new: true }
  );

  if (!saved) {
    return sendError(res, 409, "Conflict", "Order was updated concurrently");
  }

  await consumeOrderStock(saved);
  return sendSuccess(res, 200, { order: formatOrder(saved) });
}

export async function postStoreMessage(req, res) {
  const order = await loadStoreOrder(req, res);
  if (!order) return;

  if (order.status === ORDER_STATUS.REJECTED) {
    return sendError(res, 400, "Invalid state", "Order was rejected");
  }

  const { message, type } = req.validated;

  let prepUpdate = {};
  if (type === "prep_note") {
    const combined = order.prepNotes
      ? `${order.prepNotes}\n${message}`
      : message;
    // Cap at schema maxlength to avoid silent validator drops on update.
    prepUpdate = { prepNotes: combined.slice(-1000) };
  }

  const saved = await Order.findOneAndUpdate(
    { _id: order._id, storeId: req.userId, version: order.version },
    {
      $inc: { version: 1 },
      $set: prepUpdate,
      $push: {
        storeMessages: {
          $each: [{ type, message, createdAt: new Date() }],
          $slice: -50,
        },
      },
    },
    { new: true, runValidators: true }
  );

  if (!saved) {
    return sendError(res, 409, "Conflict", "Order was updated concurrently");
  }

  return sendSuccess(res, 200, { order: formatOrder(saved) });
}

export async function listRejectedOrders(req, res) {
  const storeId = req.userId;
  const orders = await Order.find({
    storeId,
    status: ORDER_STATUS.REJECTED,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const RefundTicket = (await import("../Schema/RefundTicket.js")).default;
  const tickets = await RefundTicket.find({
    storeId,
    orderId: { $in: orders.map((o) => o._id) },
  }).lean();

  const ticketMap = new Map();
  for (const t of tickets) {
    ticketMap.set(String(t.orderId), {
      id: String(t._id),
      status: t.status,
      providerRefundId: t.providerRefundId,
      supportPhone: t.supportPhone,
      providerError: t.providerError,
    });
  }

  const results = orders.map((o) => ({
    ...formatOrder(o),
    refund: ticketMap.get(String(o._id)) || null,
  }));

  return sendSuccess(res, 200, { orders: results });
}

export async function storeOrderReport(req, res) {
  const storeId = req.userId;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const orders = await Order.find({
    storeId,
    createdAt: { $gte: startOfDay },
  }).lean();

  const byStatus = {};
  for (const s of Object.values(ORDER_STATUS)) {
    byStatus[s] = 0;
  }

  let revenue = 0;
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (
      [
        ORDER_STATUS.ACCEPTED,
        ORDER_STATUS.PREPARING,
        ORDER_STATUS.READY,
        ORDER_STATUS.IN_DELIVERY,
        ORDER_STATUS.DELIVERED,
      ].includes(o.status)
    ) {
      revenue += o.totalAmount;
    }
  }

  return sendSuccess(res, 200, {
    report: {
      date: startOfDay.toISOString().slice(0, 10),
      totalOrders: orders.length,
      byStatus,
      revenueToday: Math.round(revenue * 100) / 100,
    },
  });
}

// SSE: pushes this store's order changes in real time (replaces polling).
export function streamStoreOrders(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write("retry: 5000\n\n");

  const send = (order) =>
    res.write(`event: order\ndata: ${JSON.stringify(formatOrder(order))}\n\n`);
  const unsubscribe = onStoreOrderUpdate(req.userId, send);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
}
