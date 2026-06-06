import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import {
  validate,
  validateQuery,
  createMenuItemSchema,
  updateMenuItemSchema,
  createComboSchema,
  updateComboSchema,
  createDiscountSchema,
  listMenuItemsQuerySchema,
  listCombosQuerySchema,
  recentCategoriesQuerySchema,
} from "../Validators/inventoryValidator.js";
import {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deactivateMenuItem,
  activateMenuItem,
  deleteMenuItem,
  uploadMenuItemImage,
  deleteMenuItemImage,
  getRecentCategories,
} from "../Controllers/menuItemController.js";
import {
  listCombos,
  createCombo,
  updateCombo,
  deactivateCombo,
} from "../Controllers/comboController.js";
import {
  listDiscounts,
  createDiscount,
  deactivateDiscount,
} from "../Controllers/discountController.js";
import {
  uploadMenuImage,
  handleUploadError,
} from "../Middleware/uploadMenuImage.js";
import {
  uploadMemoryImage,
  handleUploadError as handleMemoryUploadError,
} from "../Middleware/uploadMemoryImage.js";
import { isCloudinaryEnabled } from "../Services/cloudinaryService.js";

function uploadItemImageMiddleware(req, res, next) {
  const handler = isCloudinaryEnabled() ? uploadMemoryImage : uploadMenuImage;
  const onError = isCloudinaryEnabled()
    ? handleMemoryUploadError
    : handleUploadError;
  handler(req, res, (err) => {
    if (err) return onError(err, req, res, next);
    next();
  });
}

const router = Router();

router.get("/items", validateQuery(listMenuItemsQuerySchema), asyncHandler(listMenuItems));
router.post("/items", validate(createMenuItemSchema), asyncHandler(createMenuItem));
router.put(
  "/items/:id",
  validate(updateMenuItemSchema),
  asyncHandler(updateMenuItem)
);
router.patch("/items/:id/deactivate", asyncHandler(deactivateMenuItem));
router.patch("/items/:id/activate", asyncHandler(activateMenuItem));
router.delete("/items/:id", asyncHandler(deleteMenuItem));
router.post(
  "/items/:id/image",
  uploadItemImageMiddleware,
  asyncHandler(uploadMenuItemImage)
);
router.delete("/items/:id/image", asyncHandler(deleteMenuItemImage));

router.get(
  "/categories/recent",
  validateQuery(recentCategoriesQuerySchema),
  asyncHandler(getRecentCategories)
);

router.get("/combos", validateQuery(listCombosQuerySchema), asyncHandler(listCombos));
router.post("/combos", validate(createComboSchema), asyncHandler(createCombo));
router.put(
  "/combos/:id",
  validate(updateComboSchema),
  asyncHandler(updateCombo)
);
router.patch("/combos/:id/deactivate", asyncHandler(deactivateCombo));

router.get("/discounts", asyncHandler(listDiscounts));
router.post(
  "/discounts",
  validate(createDiscountSchema),
  asyncHandler(createDiscount)
);
router.patch("/discounts/:id/deactivate", asyncHandler(deactivateDiscount));

export default router;
