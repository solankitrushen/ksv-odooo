import { Router } from "express";
import { VB_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import { listMyRfqs, getMyRfq } from "../Controllers/quotationController.js";
import { vendorDashboard } from "../Controllers/vbVendorAnalyticsController.js";
import {
  listMyQuotations,
  listMyPurchaseOrders,
  downloadMyPurchaseOrder,
  listMyInvoices,
  downloadMyInvoice,
  listMyTickets,
  getMyTicket,
  replyMyTicket,
} from "../Controllers/vbVendorPortalController.js";
import { validate } from "../Validators/authValidator.js";
import { ticketReplySchema } from "../Validators/workflowValidator.js";

const VENDOR = [VB_ROLES.VENDOR];

const router = Router();
router.use(authMiddleware, tenantContext, roleMiddleware(VENDOR));

// Vendor RFQ inbox + detail (with own quotation status) — FR-3 / FR-4
router.get("/rfqs", asyncHandler(listMyRfqs));
router.get("/rfqs/:id", asyncHandler(getMyRfq));
router.get("/analytics", asyncHandler(vendorDashboard));

// Vendor self-service: own quotations, purchase orders, invoices, tickets
router.get("/quotations", asyncHandler(listMyQuotations));
router.get("/purchase-orders", asyncHandler(listMyPurchaseOrders));
router.get("/purchase-orders/:id/download", asyncHandler(downloadMyPurchaseOrder));
router.get("/invoices", asyncHandler(listMyInvoices));
router.get("/invoices/:id/download", asyncHandler(downloadMyInvoice));
router.get("/tickets", asyncHandler(listMyTickets));
router.get("/tickets/:id", asyncHandler(getMyTicket));
router.post("/tickets/:id/reply", validate(ticketReplySchema), asyncHandler(replyMyTicket));

export default router;
