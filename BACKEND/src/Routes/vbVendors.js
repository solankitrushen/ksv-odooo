import { Router } from "express";
import {
  activateVendor,
  createVendor,
  deactivateVendor,
  getVendor,
  listVendors,
  resetVendorCredentials,
  updateVendor,
} from "../Controllers/vendorController.js";
import { VB_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { createVendorSchema, listVendorsQuerySchema, updateVendorSchema } from "../Validators/vendorValidator.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import { validate } from "../Validators/authValidator.js";
import { validateQuery } from "../Validators/inventoryValidator.js";

const router = Router();

router.use(authMiddleware, tenantContext, roleMiddleware([VB_ROLES.ADMIN, VB_ROLES.OFFICER]));

router.post("/", validate(createVendorSchema), asyncHandler(createVendor));
router.get("/", validateQuery(listVendorsQuerySchema), asyncHandler(listVendors));
router.get("/:id", asyncHandler(getVendor));
router.patch("/:id", validate(updateVendorSchema), asyncHandler(updateVendor));
router.post("/:id/deactivate", asyncHandler(deactivateVendor));
router.post("/:id/activate", asyncHandler(activateVendor));
router.post("/:id/reset-credentials", asyncHandler(resetVendorCredentials));

export default router;
