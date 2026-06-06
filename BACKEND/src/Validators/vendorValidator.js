import { z } from "zod";
import { VENDOR_STATUS } from "../../config/constants.js";

const phone = z.string().regex(/^[0-9]{7,15}$/, "Invalid phone number");

export const createVendorSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  category: z.string().min(1).max(80).trim(),
  contactPerson: z.string().max(120).trim().optional(),
  email: z.string().email().max(160).toLowerCase(),
  gstNumber: z.string().max(20).trim().optional(),
  phone: phone.optional(),
});

export const updateVendorSchema = z
  .object({
    name: z.string().min(2).max(150).trim().optional(),
    category: z.string().min(1).max(80).trim().optional(),
    contactPerson: z.string().max(120).trim().optional(),
    gstNumber: z.string().max(20).trim().optional(),
    phone: phone.optional(),
    status: z.nativeEnum(VENDOR_STATUS).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });

export const listVendorsQuerySchema = z.object({
  category: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
  q: z.string().trim().max(120).optional(),
  status: z.nativeEnum(VENDOR_STATUS).optional(),
});
