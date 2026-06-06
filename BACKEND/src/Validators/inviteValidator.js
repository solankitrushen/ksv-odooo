import { z } from "zod";

export const activateVendorSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  password: z.string().min(8).max(128),
  token: z.string().min(10).max(256),
});
