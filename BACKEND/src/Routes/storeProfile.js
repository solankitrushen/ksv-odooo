import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { validate } from "../Validators/authValidator.js";
import {
  updateStoreLocationSchema,
  updateStoreProfileSchema,
  updateStoreOrderingSchema,
} from "../Validators/storeProfileValidator.js";
import {
  updateStoreLocation,
  getStoreProfile,
  updateStoreProfile,
  updateStoreOrdering,
} from "../Controllers/storeProfileController.js";

const router = Router();

router.get("/", asyncHandler(getStoreProfile));
router.patch(
  "/",
  validate(updateStoreProfileSchema),
  asyncHandler(updateStoreProfile)
);
router.patch(
  "/ordering",
  validate(updateStoreOrderingSchema),
  asyncHandler(updateStoreOrdering)
);
router.patch(
  "/location",
  validate(updateStoreLocationSchema),
  asyncHandler(updateStoreLocation)
);

export default router;
