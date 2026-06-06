import Ticket from "../Schema/Ticket.js";
import { nextReference } from "./referenceService.js";
import { getPeerStats } from "./quotationPeerStatsService.js";
import { TICKET_STATUS, TICKET_TYPE } from "../../config/constants.js";

const rupees = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;

/**
 * Build an AI bargaining draft for a submitted quotation. Uses anonymized peer
 * medians (never naming a competitor) to propose target unit prices and a
 * negotiation message. Returns { subject, body, targetUnitPrices } or null when
 * there is nothing to bargain on.
 */
export async function buildBargainDraft({ tenantId, rfq, quotation }) {
  let peerStats = {};
  try {
    peerStats = await getPeerStats({
      tenantId,
      rfqId: rfq._id,
      excludeVendorId: quotation.vendorId,
    });
  } catch {
    peerStats = {};
  }

  const targetUnitPrices = {};
  const lines = [];
  (quotation.items || []).forEach((it, i) => {
    const id = it.rfqItemId ?? String(i);
    const price = Number(it.unitPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    const ps = peerStats?.[id] ?? peerStats?.[i];
    const median = ps ? Number(ps.median) : null;
    // Target = peer median when our price is >10% above it, else a 5% trim.
    let target;
    if (median && median > 0 && price > median * 1.1) {
      target = Math.round(median);
    } else {
      target = Math.round(price * 0.95);
    }
    if (target < price) {
      targetUnitPrices[id] = target;
      lines.push(
        `• ${it.name}: quoted ${rupees(price)} → requested ${rupees(target)}`
      );
    }
  });

  if (lines.length === 0) return null;

  const subject = `Price revision request — ${rfq.reference || rfq.title}`;
  const body = [
    `Hello,`,
    ``,
    `Thank you for your quotation on "${rfq.title}". We'd like to request a revision on the following line items to move forward:`,
    ``,
    ...lines,
    ``,
    `These targets reflect competitive benchmarks for this RFQ. If you can revise and resubmit your quotation accordingly, we can proceed to approval quickly.`,
    ``,
    `Regards,`,
    `Procurement team`,
  ].join("\n");

  return { subject, body, targetUnitPrices };
}

export async function createTicket({
  tenantId,
  rfqId,
  quotationId = null,
  vendorId,
  type = TICKET_TYPE.GENERAL,
  subject,
  body,
  priority = "medium",
  aiGenerated = false,
  targetUnitPrices = undefined,
  createdBy,
  authorRole = "admin",
}) {
  const reference = await nextReference(tenantId, "ticket");
  const messages = body
    ? [{ authorRole: aiGenerated ? "ai" : authorRole, authorId: createdBy, body }]
    : [];
  return Ticket.create({
    tenantId,
    reference,
    rfqId,
    quotationId,
    vendorId,
    type,
    subject,
    priority,
    aiGenerated,
    targetUnitPrices,
    messages,
    createdBy,
    status: TICKET_STATUS.AWAITING_VENDOR,
  });
}

export async function addMessage({ ticket, authorRole, authorId, body }) {
  ticket.messages.push({ authorRole, authorId, body });
  // toggle who we're waiting on
  ticket.status =
    authorRole === "vendor"
      ? TICKET_STATUS.AWAITING_ADMIN
      : TICKET_STATUS.AWAITING_VENDOR;
  await ticket.save();
  return ticket;
}

export async function closeTicket({ ticket, resolved = true }) {
  ticket.status = resolved ? TICKET_STATUS.RESOLVED : TICKET_STATUS.CLOSED;
  ticket.closedAt = new Date();
  await ticket.save();
  return ticket;
}
