import express, { Router } from "express";
import { razorpayWebhook } from "../Controllers/webhookController.js";
import { asyncHandler } from "../Utils/asyncHandler.js";

const router = Router();

// Razorpay sends application/json; raw body needed for HMAC verification.
router.post(
  "/razorpay",
  express.raw({ type: "*/*", limit: "1mb" }),
  asyncHandler(razorpayWebhook)
);

export default router;
