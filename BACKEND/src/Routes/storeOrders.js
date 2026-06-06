import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import {
  validate,
  validateQuery,
  acceptOrderSchema,
  rejectOrderSchema,
  updateOrderStatusSchema,
  completeDeliverySchema,
  storeMessageSchema,
  listOrdersQuerySchema,
} from "../Validators/orderValidator.js";
import {
  listStoreOrders,
  getStoreOrder,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  completeDelivery,
  postStoreMessage,
  storeOrderReport,
  listRejectedOrders,
  streamStoreOrders,
} from "../Controllers/storeOrderController.js";
import {
  uploadMemoryImage,
  handleUploadError,
} from "../Middleware/uploadMemoryImage.js";

const router = Router();

router.get(
  "/report",
  asyncHandler(storeOrderReport)
);
router.get(
  "/rejected",
  asyncHandler(listRejectedOrders)
);
router.get("/stream", streamStoreOrders);
router.get(
  "/",
  validateQuery(listOrdersQuerySchema),
  asyncHandler(listStoreOrders)
);
router.get("/:id", asyncHandler(getStoreOrder));
router.patch("/:id/accept", validate(acceptOrderSchema), asyncHandler(acceptOrder));
router.patch(
  "/:id/reject",
  validate(rejectOrderSchema),
  asyncHandler(rejectOrder)
);
router.patch(
  "/:id/status",
  validate(updateOrderStatusSchema),
  asyncHandler(updateOrderStatus)
);
router.post(
  "/:id/complete-delivery",
  uploadMemoryImage,
  handleUploadError,
  validate(completeDeliverySchema),
  asyncHandler(completeDelivery)
);
router.post(
  "/:id/message",
  validate(storeMessageSchema),
  asyncHandler(postStoreMessage)
);

export default router;
