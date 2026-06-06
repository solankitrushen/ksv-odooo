import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { sendSuccess } from "../Utils/errorResponse.js";
import {
  getPublicStores,
  getPublicMenu,
  getPublicCombos,
  getTrendingItems,
  getMostPurchasedItems,
} from "../Controllers/publicMenuController.js";

const router = Router();

router.get("/stores", asyncHandler(getPublicStores));
router.get("/menu", asyncHandler(getPublicMenu));
router.get("/combos", asyncHandler(getPublicCombos));
router.get("/trending", asyncHandler(getTrendingItems));
router.get("/most-purchased", asyncHandler(getMostPurchasedItems));

router.get(
  "/refund-policy",
  asyncHandler((_req, res) =>
    sendSuccess(res, 200, {
      policy:
        "If your order is rejected by the store, you are entitled to a full refund. " +
        "Refunds are processed automatically where possible via the original payment method. " +
        "If automatic processing fails, our team will handle it within 2-3 business days.",
      supportPhone: process.env.PLATFORM_SUPPORT_PHONE || null,
      supportEmail: process.env.PLATFORM_SUPPORT_EMAIL || null,
    })
  )
);

export default router;
