import { z } from "zod";
import { phoneRegex, passwordSchema } from "./commonValidator.js";
import { isDisposableEmail } from "../Utils/disposableEmail.js";

const emailNotDisposable = (email, ctx) => {
  if (email && isDisposableEmail(email)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Disposable or temporary email addresses are not allowed",
      path: ["email"],
    });
  }
};

export const userRegisterSchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().toLowerCase().optional(),
    phone: z.string().regex(phoneRegex, "Invalid phone (10 digits)").optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    address: z
      .object({
        street: z.string().min(1).optional(),
        city: z.string().min(1).optional(),
        zipCode: z.string().regex(/^[0-9]{6}$/).optional(),
      })
      .optional(),
  })
  .refine((d) => d.email || d.phone, {
    message: "Provide email or phone",
    path: ["email"],
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((d, ctx) => emailNotDisposable(d.email, ctx));

export const verifyEmailSchema = z.object({
  userId: z
    .string()
    .min(1)
    .refine((id) => /^[a-fA-F0-9]{24}$/.test(id), "Invalid userId"),
  otp: z.union([z.string(), z.number()]).transform(String),
});

export const resendOTPSchema = z.object({
  userId: z.string().min(1),
});

export const userLoginSchema = z
  .object({
    email: z.string().email().toLowerCase().optional(),
    phone: z.string().regex(phoneRegex).optional(),
    password: z.string().min(1, "Password required"),
  })
  .refine((d) => d.email || d.phone, {
    message: "Provide email or phone",
  });

export const loginOTPSchema = z
  .object({
    email: z.string().email().toLowerCase(),
  })
  .superRefine((d, ctx) => emailNotDisposable(d.email, ctx));

export const verifyLoginOTPSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp: z.union([z.string(), z.number()]).transform(String),
});

export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const storeRegisterSchema = z
  .object({
    name: z.string().min(3).max(100).trim(),
    phone: z.string().regex(phoneRegex, "Invalid phone"),
    email: z.string().email().toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
    address: z.object({
      street: z.string().min(5),
      city: z.string().min(2),
      zipCode: z.string().regex(/^[0-9]{6}$/, "Invalid zip"),
    }),
    location: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    upiId: z
      .string()
      .regex(/^[\w.-]+@[\w.-]+$/, "Invalid UPI ID")
      .optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((d, ctx) => emailNotDisposable(d.email, ctx));

export const storeLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password required"),
});

export const adminCreateStoreSchema = z
  .object({
    name: z.string().min(3).max(100).trim(),
    phone: z.string().regex(phoneRegex, "Invalid phone"),
    email: z.string().email().toLowerCase(),
    password: passwordSchema,
    address: z.object({
      street: z.string().min(5),
      city: z.string().min(2),
      zipCode: z.string().regex(/^[0-9]{6}$/, "Invalid zip"),
      building: z.string().max(120).optional(),
      block: z.string().max(60).optional(),
      shopNumber: z.string().max(40).optional(),
      landmark: z.string().max(200).optional(),
    }),
    location: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
    owner: z
      .object({
        name: z.string().min(2).max(100).trim(),
        phone: z.string().regex(phoneRegex, "Invalid owner phone"),
      })
      .optional(),
    upiId: z
      .string()
      .regex(/^[\w.-]+@[\w.-]+$/, "Invalid UPI ID")
      .optional(),
    cuisineTypes: z.array(z.string()).optional(),
    commissionPercent: z.number().min(0).max(100).optional(),
  })
  .superRefine((d, ctx) => emailNotDisposable(d.email, ctx));

export const adminStoreRazorpaySchema = z
  .object({
    linkedAccountId: z
      .string()
      .regex(/^acc_[A-Za-z0-9]{8,}$/, "Invalid Razorpay account ID")
      .nullable()
      .optional(),
    commissionPercent: z.number().min(0).max(100).optional(),
    beneficiaryName: z.string().min(2).max(120).trim().optional(),
    contactName: z.string().min(2).max(120).trim().optional(),
    contactEmail: z.string().email().toLowerCase().optional(),
    contactPhone: z.string().regex(phoneRegex, "Invalid phone").optional(),
    bankAccountNumber: z.string().min(6).max(34).optional(),
    ifscCode: z
      .string()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC")
      .optional(),
    legalBusinessName: z.string().min(3).max(200).trim().optional(),
    businessType: z
      .enum([
        "proprietorship",
        "partnership",
        "private_limited",
        "public_limited",
        "llp",
        "ngo",
        "trust",
        "society",
        "not_yet_registered",
        "individual",
      ])
      .optional(),
    profileCategory: z.string().min(2).max(60).optional(),
    profileSubcategory: z.string().min(2).max(60).optional(),
    address: z
      .object({
        street1: z.string().min(3).max(200).optional(),
        street2: z.string().max(200).optional(),
        city: z.string().min(2).max(100).optional(),
        state: z.string().min(2).max(60).optional(),
        postalCode: z.string().regex(/^[0-9]{6}$/, "Invalid postal").optional(),
        country: z.string().length(2).optional(),
      })
      .optional(),
    pan: z
      .string()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN")
      .optional(),
    gst: z
      .string()
      .regex(/^[0-9A-Z]{15}$/, "Invalid GSTIN")
      .optional(),
    referenceId: z.string().min(3).max(40).optional(),
    onboardingStatus: z
      .enum([
        "pending",
        "created",
        "under_review",
        "needs_clarification",
        "active",
        "suspended",
        "rejected",
      ])
      .optional(),
  })
  .strict();

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password required"),
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
