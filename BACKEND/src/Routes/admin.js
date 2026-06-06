import { Router } from "express";
import adminInventoryRoutes from "./adminInventory.js";
import adminDashboardRoutes from "./adminDashboard.js";
import adminStoresRoutes from "./adminStores.js";

const router = Router();

router.use(adminDashboardRoutes);
router.use(adminInventoryRoutes);
router.use(adminStoresRoutes);

export default router;
