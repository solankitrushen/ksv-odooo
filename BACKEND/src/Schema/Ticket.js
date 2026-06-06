import mongoose from "mongoose";
import { TICKET_STATUS, TICKET_TYPE } from "../../config/constants.js";

const ticketMessageSchema = new mongoose.Schema(
  {
    // who authored: "admin" (staff) or "vendor" or "ai"
    authorRole: { type: String, enum: ["admin", "vendor", "ai"], required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", default: null },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Ticket — staff↔vendor thread tied to an RFQ (optionally a quotation).
 * `bargain` tickets carry a targetUnitPrices map (paise) the AI proposes; the
 * thread itself never mutates quotation money — the vendor must resubmit.
 */
const ticketSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    reference: { type: String, required: true, trim: true },
    rfqId: { type: mongoose.Schema.Types.ObjectId, ref: "Rfq", required: true, index: true },
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      default: null,
    },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    type: {
      type: String,
      enum: Object.values(TICKET_TYPE),
      default: TICKET_TYPE.GENERAL,
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: Object.values(TICKET_STATUS),
      default: TICKET_STATUS.OPEN,
      index: true,
    },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    aiGenerated: { type: Boolean, default: false },
    // bargain target unit prices keyed by rfqItemId (paise). Advisory only.
    targetUnitPrices: { type: Map, of: Number, default: undefined },
    messages: { type: [ticketMessageSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", required: true },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ tenantId: 1, reference: 1 }, { unique: true });
ticketSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });
ticketSchema.index({ tenantId: 1, vendorId: 1, status: 1 });

const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);
export default Ticket;
