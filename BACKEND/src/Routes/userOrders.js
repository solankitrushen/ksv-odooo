import { Router } from "express";
import { asyncHandler } from "../Utils/asyncHandler.js";
import {
  validate,
  validateQuery,
  createOrderSchema,
  cancelOrderSchema,
  paymentOrderSchema,
  listOrdersQuerySchema,
} from "../Validators/orderValidator.js";
import {
  createOrder,
  listUserOrders,
  getUserOrder,
  cancelOrder,
} from "../Controllers/userOrderController.js";
import { createPaymentOrder } from "../Controllers/paymentController.js";
import { createOrderLimiter } from "../Middleware/orderRateLimiter.js";

const router = Router();

router.post(
  "/payment/razorpay/order",
  validate(paymentOrderSchema),
  asyncHandler(createPaymentOrder)
);
router.post(
  "/",
  createOrderLimiter,
  validate(createOrderSchema),
  asyncHandler(createOrder)
);
router.get(
  "/",
  validateQuery(listOrdersQuerySchema),
  asyncHandler(listUserOrders)
);
router.get("/:id", asyncHandler(getUserOrder));
router.post(
  "/:id/cancel",
  validate(cancelOrderSchema),
  asyncHandler(cancelOrder)
);

export default router;
