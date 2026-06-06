import RefundTicket from "../Schema/RefundTicket.js";
import { logger } from "../Utils/logger.js";
import {
  isRazorpayEnabled,
  getRazorpaySupportPhone,
  processRazorpayRefund,
} from "./razorpayService.js";
import Store from "../Schema/Store.js";

export async function createRefundTicket({
  orderId,
  userId,
  storeId,
  amount,
  reason,
  paymentReference,
  paymentProvider,
}) {
  const existing = await RefundTicket.findOne({ orderId });
  if (existing) {
    return { ok: true, ticket: existing, existed: true };
  }

  const store = await Store.findById(storeId).select("phone owner.phone");
  const supportPhone = store?.owner?.phone || store?.phone || getRazorpaySupportPhone();

  const ticket = await RefundTicket.create({
    orderId,
    userId,
    storeId,
    amount,
    reason,
    status: "pending",
    provider: paymentProvider || null,
    supportPhone,
    notes: "Auto-generated on order reject",
  });

  return { ok: true, ticket, existed: false };
}

export async function processRefund({ orderId, paymentReference, amount, provider }) {
  const ticket = await RefundTicket.findOne({ orderId });
  if (!ticket) {
    return { ok: false, message: "No refund ticket found" };
  }

  if (["processed", "failed"].includes(ticket.status)) {
    return { ok: true, ticket, message: `Refund already ${ticket.status}` };
  }

  // Unpaid or test orders — cannot auto-refund, mark manual.
  if (!provider || provider === "test" || !paymentReference) {
    ticket.status = "manual";
    ticket.notes = "No payment captured — refund requires manual handling";
    await ticket.save();
    return { ok: true, ticket, message: "Manual refund required (unpaid/test order)" };
  }

  ticket.status = "processing";
  await ticket.save();

  if (provider === "razorpay" && isRazorpayEnabled()) {
    const result = await processRazorpayRefund({
      paymentId: paymentReference,
      amountInr: amount,
      notes: { orderId: String(orderId), reason: ticket.reason },
    });

    if (result.ok) {
      ticket.status = "processed";
      ticket.providerRefundId = result.refundId;
    } else {
      ticket.status = "manual";
      ticket.providerError = result.message;
      ticket.notes = `Auto-refund failed: ${result.message}. Manual processing required.`;
    }
  } else {
    ticket.status = "manual";
    ticket.notes = "Provider not configured for auto-refund";
  }

  await ticket.save();
  return { ok: true, ticket };
}

export async function getRefundTicket(orderId) {
  const ticket = await RefundTicket.findOne({ orderId });
  if (!ticket) return null;
  return {
    id: String(ticket._id),
    orderId: String(ticket.orderId),
    userId: String(ticket.userId),
    storeId: String(ticket.storeId),
    amount: ticket.amount,
    reason: ticket.reason,
    status: ticket.status,
    provider: ticket.provider,
    providerRefundId: ticket.providerRefundId,
    supportPhone: ticket.supportPhone,
    notes: ticket.notes,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export async function listRefundTickets(query = {}) {
  const filter = {};
  if (query.storeId) filter.storeId = query.storeId;
  if (query.status) filter.status = query.status;

  const tickets = await RefundTicket.find(filter)
    .sort({ createdAt: -1 })
    .limit(query.limit || 50)
    .lean();

  return tickets.map((t) => ({
    id: String(t._id),
    orderId: String(t.orderId),
    userId: String(t.userId),
    storeId: String(t.storeId),
    amount: t.amount,
    reason: t.reason,
    status: t.status,
    provider: t.provider,
    providerRefundId: t.providerRefundId,
    supportPhone: t.supportPhone,
    notes: t.notes,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

export async function markTicketManual(orderId, notes) {
  const ticket = await RefundTicket.findOne({ orderId });
  if (!ticket) return null;
  ticket.status = "manual";
  if (notes) ticket.notes = notes;
  await ticket.save();
  return ticket;
}
