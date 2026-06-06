import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { validate as validateBody } from "../Validators/orderValidator.js";
import {
  createAddressSchema,
  updateAddressSchema,
} from "../Validators/addressValidator.js";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../Controllers/userAddressController.js";

const router = Router();

router.get("/", asyncHandler(listAddresses));
router.post("/", validateBody(createAddressSchema), asyncHandler(createAddress));
router.patch("/:addressId", validateBody(updateAddressSchema), asyncHandler(updateAddress));
router.delete("/:addressId", asyncHandler(deleteAddress));
router.patch("/:addressId/default", asyncHandler(setDefaultAddress));

export default router;
