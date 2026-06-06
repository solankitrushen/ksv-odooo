import { z } from "zod";
import { phoneRegex } from "./commonValidator.js";
import { MIN_ORDER_AMOUNT_INR } from "../../config/constants.js";

export const updateStoreOrderingSchema = z
  .object({
    minOrderValue: z.number().min(MIN_ORDER_AMOUNT_INR).max(100000).optional(),
    freeDeliveryThreshold: z.number().min(0).max(100000).optional(),
    deliveryFee: z.number().min(0).max(10000).optional(),
    freeRadiusKm: z.number().min(0).max(50).optional(),
    maxRadiusKm: z.number().min(0).max(50).optional(),
    perKmFee: z.number().min(0).max(10000).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No ordering fields supplied",
  });

export const updateStoreLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const updateStoreProfileSchema = z.object({
  name: z.string().min(3).max(100).trim().optional(),
  address: z
    .object({
      street: z.string().min(5),
      city: z.string().min(2),
      zipCode: z.string().regex(/^[0-9]{6}$/, "Invalid zip"),
      building: z.string().max(120),
      block: z.string().max(60),
      shopNumber: z.string().max(40),
      landmark: z.string().max(200),
    })
    .partial()
    .optional(),
  owner: z
    .object({
      name: z.string().min(2).max(100).trim(),
      phone: z.string().regex(phoneRegex, "Invalid owner phone"),
    })
    .partial()
    .optional(),
  upiId: z
    .string()
    .regex(/^[\w.-]+@[\w.-]+$/, "Invalid UPI ID")
    .optional(),
  cuisineTypes: z
    .array(
      z.enum([
        "north-indian",
        "south-indian",
        "chinese",
        "continental",
        "desserts",
        "beverages",
      ])
    )
    .optional(),
});
