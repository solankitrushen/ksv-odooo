import express from "express";
import { Router } from "express";
import authRoutes from "./auth.js";
import adminRoutes from "./admin.js";
import publicMenuRoutes from "./publicMenu.js";
import userMenuRoutes from "./userMenu.js";
import userOrdersRoutes from "./userOrders.js";
import userAddressRoutes from "./userAddresses.js";
import storeOrdersRoutes from "./storeOrders.js";
import storeProfileRoutes from "./storeProfile.js";
import storeInventoryRoutes from "./storeInventory.js";
import storeAnalyticsRoutes from "./storeAnalytics.js";
import vbAuthRoutes from "./vbAuth.js";
import vbVendorRoutes from "./vbVendors.js";
import vbRfqRoutes from "./vbRfq.js";
import vbQuotationRoutes from "./vbQuotations.js";
import vbVendorPortalRoutes from "./vbVendorPortal.js";
import vbAnalyticsRoutes from "./vbAnalytics.js";
import vbTicketRoutes from "./vbTickets.js";
import { purchaseOrders as vbPurchaseOrderRoutes, invoices as vbInvoiceRoutes } from "./vbDocuments.js";
import vbActivityRoutes from "./vbActivity.js";
import vbAssistantRoutes from "./vbAssistant.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { ROLES } from "../../config/constants.js";
import { getMenuUploadDir } from "../Utils/menuPaths.js";
import {
  mongoSanitizeMiddleware,
  xssProtection,
  parameterTypeValidator,
  sensitiveRouteLogger,
} from "../Middleware/inputSanitizer.js";
import { csrfProtection } from "../Middleware/csrf.js";

const router = Router();

router.use(sensitiveRouteLogger);
router.use(mongoSanitizeMiddleware);
router.use(xssProtection);
router.use(parameterTypeValidator);
router.use(csrfProtection);

router.use("/auth", authRoutes);

router.use("/vb/auth", vbAuthRoutes);
router.use("/vb/vendors", vbVendorRoutes);
router.use("/vb/rfq", vbRfqRoutes);
router.use("/vb/vendor", vbVendorPortalRoutes);
router.use("/vb/quotations", vbQuotationRoutes);
router.use("/vb/analytics", vbAnalyticsRoutes);
router.use("/vb/tickets", vbTicketRoutes);
router.use("/vb/purchase-orders", vbPurchaseOrderRoutes);
router.use("/vb/invoices", vbInvoiceRoutes);
router.use("/vb/activity", vbActivityRoutes);
router.use("/vb/assistant", vbAssistantRoutes);

router.use("/public/menu", express.static(getMenuUploadDir()));
router.use("/public", publicMenuRoutes);

router.use(
  "/admin",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  adminRoutes
);

router.use(
  "/user",
  authMiddleware,
  roleMiddleware([ROLES.USER]),
  userMenuRoutes
);

router.use(
  "/user/orders",
  authMiddleware,
  roleMiddleware([ROLES.USER]),
  userOrdersRoutes
);

router.use(
  "/user/addresses",
  authMiddleware,
  roleMiddleware([ROLES.USER]),
  userAddressRoutes
);

router.use(
  "/store/orders",
  authMiddleware,
  roleMiddleware([ROLES.STORE]),
  storeOrdersRoutes
);

router.use(
  "/store/profile",
  authMiddleware,
  roleMiddleware([ROLES.STORE]),
  storeProfileRoutes
);

router.use(
  "/store/inventory",
  authMiddleware,
  roleMiddleware([ROLES.STORE]),
  storeInventoryRoutes
);

router.use(
  "/store/analytics",
  authMiddleware,
  roleMiddleware([ROLES.STORE]),
  storeAnalyticsRoutes
);

export default router;
