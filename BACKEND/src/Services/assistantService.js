import mongoose from "mongoose";
import Vendor from "../Schema/Vendor.js";
import Rfq from "../Schema/Rfq.js";
import Quotation from "../Schema/Quotation.js";
import Invoice from "../Schema/Invoice.js";
import PurchaseOrder from "../Schema/PurchaseOrder.js";
import Ticket from "../Schema/Ticket.js";
import {
  QUOTATION_APPROVAL_STATUS,
  QUOTATION_STATUS,
  RFQ_STATUS,
  VENDOR_STATUS,
} from "../../config/constants.js";

const inr = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;

/** Gather a live, tenant-scoped snapshot the assistant grounds its answers in. */
export async function getSnapshot(tenantId) {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const [
    activeVendors,
    activeRfqs,
    pending,
    submitted,
    spendAgg,
    invoices,
    pos,
    openTickets,
    topVendorsAgg,
  ] = await Promise.all([
    Vendor.countDocuments({ tenantId, status: VENDOR_STATUS.ACTIVE }),
    Rfq.countDocuments({ tenantId, status: RFQ_STATUS.ACTIVE }),
    Quotation.countDocuments({
      tenantId,
      status: QUOTATION_STATUS.SUBMITTED,
      "approval.status": QUOTATION_APPROVAL_STATUS.PENDING,
    }),
    Quotation.countDocuments({ tenantId, status: QUOTATION_STATUS.SUBMITTED }),
    Quotation.aggregate([
      { $match: { tenantId: tid, "approval.status": QUOTATION_APPROVAL_STATUS.APPROVED } },
      { $group: { _id: null, total: { $sum: "$computed.grandTotal" }, count: { $sum: 1 } } },
    ]),
    Invoice.countDocuments({ tenantId }),
    PurchaseOrder.countDocuments({ tenantId }),
    Ticket.countDocuments({ tenantId, status: { $in: ["open", "awaiting_vendor", "awaiting_admin"] } }),
    Quotation.aggregate([
      { $match: { tenantId: tid, status: QUOTATION_STATUS.SUBMITTED } },
      { $group: { _id: "$vendorId", total: { $sum: "$computed.grandTotal" } } },
      { $sort: { total: -1 } },
      { $limit: 3 },
    ]),
  ]);

  const topVendorIds = topVendorsAgg.map((t) => t._id);
  const tv = await Vendor.find({ tenantId, _id: { $in: topVendorIds } })
    .select("name")
    .lean();
  const tvMap = new Map(tv.map((v) => [String(v._id), v.name]));

  return {
    activeVendors,
    activeRfqs,
    pendingApprovals: pending,
    submittedQuotations: submitted,
    approvedSpend: spendAgg[0]?.total || 0,
    approvedCount: spendAgg[0]?.count || 0,
    invoices,
    purchaseOrders: pos,
    openTickets,
    topVendors: topVendorsAgg.map((t) => ({
      name: tvMap.get(String(t._id)) || "Vendor",
      total: t.total,
    })),
  };
}

const HELP = {
  rfq: 'To create an RFQ: go to RFQs → "Create RFQ", add line items, assign vendors, and publish. Vendors then see it in their portal and submit quotations.',
  compare:
    "Open an RFQ and use Quotation Comparison to see vendors side-by-side. The lowest unit price per item is highlighted; run AI auto-review for a 0–100 score and recommendation.",
  approve:
    "In an RFQ's approvals panel, click Approve to accept a quotation — this auto-generates a Purchase Order and an Invoice, and emails the vendor. Reject sends a decline, Bargain raises an AI negotiation ticket.",
  invoice:
    "Invoices are generated automatically when you approve a quotation. From the Invoices page you can download the PDF, print it, or email it to the vendor.",
  po: "Purchase Orders are auto-created with a PO number when a quotation is approved. The invoice is generated from the PO.",
  vendor:
    'Add vendors under Vendors → "Add vendor". They receive an invite to activate their portal account, then become assignable to RFQs.',
};

function pick(q, keys) {
  return keys.some((k) => q.includes(k));
}

/**
 * Deterministic, data-grounded assistant. Interprets the question against the
 * live snapshot and returns a reply + follow-up suggestions. No external model
 * required (works offline), consistent with the heuristic AI provider.
 */
export function answer(question, snap) {
  const q = String(question || "").toLowerCase().trim();
  const suggestions = [
    "How many approvals are pending?",
    "What's our total spend?",
    "Who are the top vendors?",
    "How do I compare quotations?",
  ];

  if (!q) {
    return {
      reply:
        `Hi! I'm your VendorBridge assistant. Right now you have ${snap.activeRfqs} active RFQ(s), ` +
        `${snap.pendingApprovals} quotation(s) awaiting approval, and ${snap.activeVendors} active vendor(s). Ask me anything about your procurement.`,
      suggestions,
    };
  }

  if (pick(q, ["pending", "approval", "approve", "waiting"])) {
    if (q.includes("how do") || q.includes("how to")) {
      return { reply: HELP.approve, suggestions };
    }
    return {
      reply:
        snap.pendingApprovals > 0
          ? `You have ${snap.pendingApprovals} submitted quotation(s) awaiting a decision. Open the relevant RFQ and use the approvals panel — running AI auto-review first will score and recommend each one.`
          : "Nothing is pending approval right now. Submitted quotations will show up here for review.",
      suggestions,
    };
  }
  if (pick(q, ["spend", "cost", "total", "budget", "money"])) {
    return {
      reply: `Approved spend so far is ${inr(snap.approvedSpend)} across ${snap.approvedCount} approved quotation(s). See Reports for spend by category and monthly trends.`,
      suggestions,
    };
  }
  if (pick(q, ["top vendor", "best vendor", "which vendor", "vendor by"])) {
    if (snap.topVendors.length === 0)
      return { reply: "No submitted quotations yet, so there's no vendor ranking to show.", suggestions };
    const list = snap.topVendors.map((v, i) => `${i + 1}. ${v.name} — ${inr(v.total)}`).join("\n");
    return { reply: `Top vendors by quoted value:\n${list}`, suggestions };
  }
  if (pick(q, ["rfq", "request for quotation"])) {
    if (q.includes("how") || q.includes("create") || q.includes("new"))
      return { reply: HELP.rfq, suggestions };
    return { reply: `You have ${snap.activeRfqs} active RFQ(s). ${HELP.rfq}`, suggestions };
  }
  if (pick(q, ["compare", "comparison", "cheapest", "lowest"])) {
    return { reply: HELP.compare, suggestions };
  }
  if (pick(q, ["invoice", "bill"])) {
    return { reply: `There are ${snap.invoices} invoice(s). ${HELP.invoice}`, suggestions };
  }
  if (pick(q, ["purchase order", "po ", "po#", "purchase"])) {
    return { reply: `There are ${snap.purchaseOrders} purchase order(s). ${HELP.po}`, suggestions };
  }
  if (pick(q, ["vendor", "supplier"])) {
    return { reply: `You have ${snap.activeVendors} active vendor(s). ${HELP.vendor}`, suggestions };
  }
  if (pick(q, ["ticket", "bargain", "negotiat"])) {
    return {
      reply: `You have ${snap.openTickets} open ticket(s). Raise an AI bargaining ticket from an RFQ's approvals panel to negotiate prices toward competitive benchmarks.`,
      suggestions,
    };
  }
  if (pick(q, ["help", "what can you", "how do", "guide"])) {
    return {
      reply:
        "I can answer questions about your vendors, RFQs, approvals, spend, invoices, and purchase orders — and explain how each step works. Try one of the suggestions below.",
      suggestions,
    };
  }

  // fallback: grounded summary
  return {
    reply:
      `Here's a quick status: ${snap.activeRfqs} active RFQ(s), ${snap.pendingApprovals} pending approval(s), ` +
      `${snap.submittedQuotations} submitted quotation(s), approved spend ${inr(snap.approvedSpend)}, ` +
      `${snap.invoices} invoice(s), ${snap.openTickets} open ticket(s). Ask about any of these for detail.`,
    suggestions,
  };
}
