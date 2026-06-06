import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { validate } from "../Validators/authValidator.js";
import {
  getUserMenu,
  getUserCombos,
  getUserStore,
} from "../Controllers/userMenuController.js";
import {
  getProfile,
  updateProfile,
  updateProfileSchema,
} from "../Controllers/userProfileController.js";

const router = Router();

router.get("/store", asyncHandler(getUserStore));
router.get("/menu", asyncHandler(getUserMenu));
router.get("/combos", asyncHandler(getUserCombos));

router.get("/profile", asyncHandler(getProfile));
router.patch("/profile", validate(updateProfileSchema), asyncHandler(updateProfile));

export default router;
