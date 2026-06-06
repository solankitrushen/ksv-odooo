import { z } from "zod";

export const phoneRegex = /^[0-9]{10}$/;

export const passwordSchema = z
  .string()
  .min(8, "Min 8 characters")
  .refine((val) => /[A-Z]/.test(val), "Need 1 uppercase letter")
  .refine((val) => /[a-z]/.test(val), "Need 1 lowercase letter")
  .refine((val) => /\d/.test(val), "Need 1 number")
  .refine((val) => /[@$!%*?&]/.test(val), "Need 1 special char (@$!%*?&)");

export function passwordsMatch(data) {
  return data.password === data.confirmPassword;
}
