import { z } from "zod";
import {
  DELIVERY_TYPES,
  ORDER_STATUS,
  STORE_MESSAGE_TYPES,
} from "../../config/constants.js";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

const orderLineInput = z
  .object({
    menuItemId: objectId.optional(),
    comboId: objectId.optional(),
    quantity: z.number().int().min(1).max(50),
  })
  .refine((d) => (d.menuItemId && !d.comboId) || (!d.menuItemId && d.comboId), {
    message: "Each line must have menuItemId or comboId, not both",
  });

const deliveryCoords = {
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional(),
};

export const createOrderSchema = z
  .object({
    storeId: objectId,
    deliveryType: z.enum(DELIVERY_TYPES),
    deliveryDistanceKm: z.number().min(0).max(100).optional().default(0),
    deliveryAddressId: z.string().max(100).optional(),
    ...deliveryCoords,
    items: z.array(orderLineInput).min(1).max(50),
    userNote: z.string().max(500).trim().optional().default(""),
    razorpayPaymentId: z.string().max(200).optional(),
    razorpayOrderId: z.string().max(200).optional(),
    razorpaySignature: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryType === "delivery") {
      if (!data.deliveryAddressId && (data.deliveryLatitude == null || data.deliveryLongitude == null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "deliveryLatitude and deliveryLongitude or deliveryAddressId required for delivery orders",
          path: ["deliveryLatitude"],
        });
      }
    }
  });

export const paymentOrderSchema = createOrderSchema;

export const acceptOrderSchema = z.object({
  preparationMinutes: z.coerce.number().int().min(1).max(240).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const rejectOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Reject reason must be at least 10 characters")
    .max(500),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.READY,
    ORDER_STATUS.IN_DELIVERY,
    ORDER_STATUS.DELIVERED,
  ]),
  note: z.string().max(500).trim().optional(),
});

export const completeDeliverySchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  proofImageUrl: z
    .string()
    .url()
    .max(2000)
    .refine((url) => {
      try {
        const host = new URL(url).hostname;
        return (
          host.includes("cloudinary.com") ||
          host.includes("res.cloudinary.com") ||
          process.env.NODE_ENV === "test"
        );
      } catch {
        return false;
      }
    }, "proofImageUrl must be a Cloudinary URL")
    .optional(),
});

export const storeMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  type: z.enum(STORE_MESSAGE_TYPES).optional().default("general"),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(Object.values(ORDER_STATUS)).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details,
      });
    }
    req.validated = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details,
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}
