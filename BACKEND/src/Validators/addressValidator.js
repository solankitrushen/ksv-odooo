import { z } from "zod";

const addressSchema = z.object({
  label: z.string().max(50).trim().optional().default("Home"),
  houseNo: z.string().max(50).trim().min(1, "House/flat number is required"),
  building: z.string().max(100).trim().optional().default(""),
  street: z.string().max(200).trim().min(1, "Street is required"),
  area: z.string().max(100).trim().optional().default(""),
  city: z.string().max(100).trim().min(1, "City is required"),
  zipCode: z.string().max(10).trim().optional().default(""),
  landmark: z.string().max(200).trim().optional().default(""),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const createAddressSchema = addressSchema;

export const updateAddressSchema = addressSchema.partial();

export const setDefaultAddressSchema = z.object({
  isDefault: z.literal(true),
});
