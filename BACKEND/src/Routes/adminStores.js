import { Router } from "express";
import {
  adminCreateStoreSchema,
  adminStoreRazorpaySchema,
  validate,
} from "../Validators/authValidator.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import {
  activateStore,
  createStoreByAdmin,
  deactivateStore,
  getStoreById,
  listStores,
  onboardStoreLinkedAccount,
  syncStoreLinkedAccount,
  sendStoreEmailOTP,
  updateStoreCredentials,
  updateStoreDetails,
  updateStoreRazorpay,
  verifyStore,
  verifyStoreEmailOTP,
} from "../Controllers/adminStoreController.js";

const router = Router();

router.post(
  "/stores",
  validate(adminCreateStoreSchema),
  asyncHandler(createStoreByAdmin)
);
router.get("/stores", asyncHandler(listStores));
router.get("/stores/:id", asyncHandler(getStoreById));
router.patch("/stores/:id/verify", asyncHandler(verifyStore));
router.patch("/stores/:id/deactivate", asyncHandler(deactivateStore));
router.patch("/stores/:id/activate", asyncHandler(activateStore));
router.patch("/stores/:id", asyncHandler(updateStoreDetails));
router.patch("/stores/:id/credentials", asyncHandler(updateStoreCredentials));
router.patch(
  "/stores/:id/razorpay",
  validate(adminStoreRazorpaySchema),
  asyncHandler(updateStoreRazorpay)
);
router.post(
  "/stores/:id/razorpay/onboard",
  asyncHandler(onboardStoreLinkedAccount)
);
router.post(
  "/stores/:id/razorpay/sync",
  asyncHandler(syncStoreLinkedAccount)
);
router.post("/stores/:id/send-email-otp", asyncHandler(sendStoreEmailOTP));
router.post("/stores/:id/verify-email-otp", asyncHandler(verifyStoreEmailOTP));

export default router;
