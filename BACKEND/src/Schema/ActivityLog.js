import mongoose from "mongoose";

/**
 * ActivityLog — append-only audit/notification trail per tenant (spec screen 10).
 * `type` groups events for the Activity tab filters (rfq | quotation | approval
 * | purchase_order | invoice | ticket | vendor). Never holds money decisions —
 * it's a record of who did what, when.
 */
const activityLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    type: {
      type: String,
      enum: [
        "rfq",
        "quotation",
        "approval",
        "purchase_order",
        "invoice",
        "ticket",
        "vendor",
      ],
      required: true,
      index: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 60 }, // created|submitted|approved|...
    message: { type: String, required: true, trim: true, maxlength: 500 },
    severity: { type: String, enum: ["info", "success", "warn", "error"], default: "info" },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "VbUser", default: null },
    actorRole: { type: String, default: null },
    rfqId: { type: mongoose.Schema.Types.ObjectId, ref: "Rfq", default: null },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation", default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

activityLogSchema.index({ tenantId: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, type: 1, createdAt: -1 });

const ActivityLog =
  mongoose.models.ActivityLog || mongoose.model("ActivityLog", activityLogSchema);
export default ActivityLog;
