import Order from "../Schema/Order.js";
import Store from "../Schema/Store.js";
import WebhookEvent from "../Schema/WebhookEvent.js";
import { verifyWebhookSignature } from "../Services/razorpayService.js";
import { mapRazorpayAccountStatus } from "../Services/razorpayAccountService.js";
import { releaseOrderStock } from "../Services/inventoryService.js";
import { logger } from "../Utils/logger.js";
import { PAYMENT_STATUS, ORDER_STATUS } from "../../config/constants.js";

const ACCOUNT_EVENT_STATUS = {
  "account.activated": "activated",
  "account.under_review": "under_review",
  "account.needs_clarification": "needs_clarification",
  "account.suspended": "suspended",
  "account.rejected": "rejected",
};

async function handleAccountEvent(event, eventType) {
  const accountEntity = event?.payload?.account?.entity;
  const accountId = accountEntity?.id;
  if (!accountId) return { handled: true, note: "no account id" };

  const rawStatus =
    ACCOUNT_EVENT_STATUS[eventType] || accountEntity.status || null;
  const mapped = mapRazorpayAccountStatus(rawStatus);

  const store = await Store.findOne({ "razorpay.linkedAccountId": accountId });
  if (!store) {
    logger.warn("Razorpay account event for unknown store", { accountId });
    return { handled: true, note: "unknown account" };
  }
  store.razorpay.onboardingStatus = mapped;
  store.razorpay.onboardingMeta = {
    ...(store.razorpay.onboardingMeta || {}),
    lastSyncedAt: new Date(),
    rawStatus: rawStatus,
    rejectionReason:
      accountEntity?.requirements?.[0]?.reason_description ||
      accountEntity?.notes?.reason ||
      undefined,
  };
  await store.save();
  return { handled: true, storeId: String(store._id) };
}

async function handleTransferEvent(event, eventType) {
  const transferEntity = event?.payload?.transfer?.entity;
  if (!transferEntity) return { handled: true, note: "no transfer entity" };

  const transferId = transferEntity.id;
  const sourceOrderId = transferEntity.source; // order_xxx
  const status =
    eventType === "transfer.failed"
      ? "failed"
      : transferEntity.status || "processed";

  const order = await Order.findOne({
    $or: [
      { "payout.transferId": transferId },
      { razorpayOrderId: sourceOrderId },
    ],
  });
  if (!order) {
    logger.warn("Transfer webhook for unknown order", {
      transferId,
      sourceOrderId,
    });
    return { handled: true, note: "order not found" };
  }
  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        "payout.transferId": transferId,
        "payout.transferStatus": status,
        "payout.transferUpdatedAt": new Date(),
      },
      $inc: { version: 1 },
    }
  );
  return { handled: true, orderId: String(order._id) };
}

function sendWebhookError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

export async function razorpayWebhook(req, res) {
  const signature = req.get("X-Razorpay-Signature");
  const rawBody = req.body; // Buffer because express.raw mounted upstream

  if (!signature || !Buffer.isBuffer(rawBody)) {
    return sendWebhookError(res, 400, "Missing signature or raw body");
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn("Razorpay webhook signature invalid", {
      ip: req.ip,
      length: rawBody.length,
    });
    return sendWebhookError(res, 401, "Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch (err) {
    return sendWebhookError(res, 400, "Invalid JSON");
  }

  const eventId = event?.id || event?.event_id;
  const eventType = event?.event;

  if (!eventId || !eventType) {
    return sendWebhookError(res, 400, "Missing event id or type");
  }

  // Idempotency — duplicate webhooks land here too.
  try {
    await WebhookEvent.create({
      provider: "razorpay",
      eventId,
      eventType,
      payload: event,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ success: true, duplicate: true });
    }
    throw err;
  }

  try {
    // Route account lifecycle events
    if (eventType.startsWith("account.")) {
      const out = await handleAccountEvent(event, eventType);
      await WebhookEvent.updateOne(
        { eventId },
        { $set: { processedAt: new Date(), processingError: out.note || null } }
      );
      return res.status(200).json({ success: true, ...out });
    }

    // Route transfer settlement events
    if (eventType.startsWith("transfer.")) {
      const out = await handleTransferEvent(event, eventType);
      await WebhookEvent.updateOne(
        { eventId },
        { $set: { processedAt: new Date(), processingError: out.note || null } }
      );
      return res.status(200).json({ success: true, ...out });
    }

    const paymentEntity = event?.payload?.payment?.entity;
    if (!paymentEntity) {
      await WebhookEvent.updateOne(
        { eventId },
        { $set: { processedAt: new Date() } }
      );
      return res.status(200).json({ success: true, ignored: true });
    }

    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;

    let order = await Order.findOne({
      $or: [
        { paymentReference: razorpayPaymentId },
        { razorpayOrderId },
      ],
    });

    if (!order) {
      await WebhookEvent.updateOne(
        { eventId },
        { $set: { processedAt: new Date(), processingError: "Order not found yet" } }
      );
      return res.status(200).json({ success: true, orderPending: true });
    }

    if (eventType === "payment.captured" || eventType === "order.paid") {
      if (order.paymentStatus !== PAYMENT_STATUS.SUCCESS) {
        const update = {
          paymentStatus: PAYMENT_STATUS.SUCCESS,
          paymentReference: razorpayPaymentId,
          razorpayOrderId,
          paymentVerifiedAt: new Date(),
        };
        const transfers =
          paymentEntity?.transfers ||
          paymentEntity?.acquirer_data?.transfers ||
          null;
        if (Array.isArray(transfers) && transfers.length > 0) {
          update["payout.transferId"] = transfers[0].id || null;
        }
        await Order.updateOne(
          { _id: order._id },
          { $set: update, $inc: { version: 1 } }
        );
      }
    } else if (eventType === "payment.failed") {
      if (
        order.paymentStatus !== PAYMENT_STATUS.SUCCESS &&
        order.status === ORDER_STATUS.PENDING
      ) {
        await Order.updateOne(
          { _id: order._id },
          {
            $set: {
              paymentStatus: PAYMENT_STATUS.FAILED,
              status: ORDER_STATUS.CANCELLED,
            },
            $inc: { version: 1 },
          }
        );
        await releaseOrderStock(order);
      }
    }

    await WebhookEvent.updateOne(
      { eventId },
      { $set: { processedAt: new Date(), orderId: order._id } }
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Razorpay webhook processing failed", {
      eventId,
      eventType,
      error: err.message,
    });
    await WebhookEvent.updateOne(
      { eventId },
      { $set: { processingError: err.message } }
    );
    // Return 200 so Razorpay does not aggressively retry on our bug.
    return res.status(200).json({ success: false, error: "Processing error" });
  }
}
