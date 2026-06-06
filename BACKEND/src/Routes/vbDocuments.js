import { Router } from "express";
import { VB_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import {
  listPurchaseOrders,
  downloadPurchaseOrder,
  listInvoices,
  downloadInvoiceById,
  emailInvoice,
} from "../Controllers/vbDocumentsController.js";

const STAFF = [VB_ROLES.ADMIN, VB_ROLES.OFFICER, VB_ROLES.MANAGER];

const purchaseOrders = Router();
purchaseOrders.use(authMiddleware, tenantContext, roleMiddleware(STAFF));
purchaseOrders.get("/", asyncHandler(listPurchaseOrders));
purchaseOrders.get("/:id/download", asyncHandler(downloadPurchaseOrder));

const invoices = Router();
invoices.use(authMiddleware, tenantContext, roleMiddleware(STAFF));
invoices.get("/", asyncHandler(listInvoices));
invoices.get("/:id/download", asyncHandler(downloadInvoiceById));
invoices.post("/:id/email", asyncHandler(emailInvoice));

export { purchaseOrders, invoices };
