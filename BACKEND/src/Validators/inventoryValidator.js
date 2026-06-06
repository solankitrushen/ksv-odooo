import { z } from "zod";
import { DISCOUNT_APPLICABLE, DISCOUNT_TYPES } from "../../config/constants.js";

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

const price = z
  .number()
  .positive("Price must be greater than 0")
  .max(999999.99);

export const createMenuItemSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  description: z.string().max(2000).trim().optional().default(""),
  price,
  // Accept either categories[] (new) or category string (legacy)
  categories: z
    .array(z.string().min(1).max(80).trim())
    .min(1, "At least one category required")
    .max(10)
    .optional(),
  category: z.string().min(1).max(80).trim().optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  imageUrl: z.string().url().max(2000).optional(),
}).transform((d) => {
  // Normalise: categories wins over category
  const cats = d.categories?.length
    ? d.categories
    : d.category
    ? [d.category]
    : [];
  return {
    ...d,
    categories: cats,
    category: cats[0] ?? "",
  };
}).refine((d) => d.category.length > 0, {
  message: "At least one category required",
  path: ["categories"],
});

export const updateMenuItemSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  price: price.optional(),
  categories: z
    .array(z.string().min(1).max(80).trim())
    .min(1)
    .max(10)
    .optional(),
  category: z.string().min(1).max(80).trim().optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
  imageUrl: z.string().url().max(2000).optional(),
}).transform((d) => {
  if (!d.categories && !d.category) return d;
  const cats = d.categories?.length
    ? d.categories
    : d.category
    ? [d.category]
    : undefined;
  return {
    ...d,
    ...(cats ? { categories: cats, category: cats[0] } : {}),
  };
}).refine(
  (d) => Object.keys(d).length > 0,
  { message: "At least one field required" }
);


export const comboLineSchema = z.object({
  itemId: objectId,
  qty: z.number().int().min(1).max(99),
});

export const createComboSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  description: z.string().max(2000).trim().optional().default(""),
  items: z.array(comboLineSchema).min(2),
  comboPrice: price,
});

export const updateComboSchema = createComboSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: "At least one field required" }
);

export const createDiscountSchema = z
  .object({
    name: z.string().min(2).max(120).trim(),
    type: z.enum(DISCOUNT_TYPES),
    value: z.number().min(0),
    applicableTo: z.enum(DISCOUNT_APPLICABLE),
    itemIds: z.array(objectId).optional().default([]),
    comboIds: z.array(objectId).optional().default([]),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
  })
  .refine((d) => d.validFrom <= d.validUntil, {
    message: "validFrom must be before or equal to validUntil",
    path: ["validUntil"],
  })
  .refine(
    (d) => {
      if (d.type === "percentage") return d.value >= 0 && d.value <= 100;
      return d.value >= 0;
    },
    { message: "Percentage must be 0–100", path: ["value"] }
  )
  .refine(
    (d) => {
      if (d.applicableTo === "items") return d.itemIds.length > 0;
      if (d.applicableTo === "combos") return d.comboIds.length > 0;
      return d.itemIds.length > 0 || d.comboIds.length > 0;
    },
    { message: "Provide target itemIds and/or comboIds", path: ["itemIds"] }
  );

const positiveInt = z.coerce.number().int().positive();
const nonNegNumber = z.coerce.number().nonnegative();

export const listMenuItemsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  active: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
  minPrice: nonNegNumber.optional(),
  maxPrice: nonNegNumber.optional(),
  sort: z.enum(["createdDesc", "nameAsc", "priceAsc", "priceDesc", "mostSold"]).optional(),
  page: positiveInt.optional(),
  pageSize: positiveInt.max(200).optional(),
  rankWindowDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const listCombosQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  active: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(["createdDesc", "nameAsc", "priceAsc", "priceDesc", "mostSold"]).optional(),
  page: positiveInt.optional(),
  pageSize: positiveInt.max(200).optional(),
  rankWindowDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const recentCategoriesQuerySchema = z.object({
  limit: positiveInt.max(50).optional(),
});

export const ocrCommitSchema = z
  .object({
    currency: z.enum(["INR", "USD"]).default("INR"),
    items: z
      .array(
        z.object({
          name: z.string().min(2).max(120).trim(),
          description: z.string().max(2000).trim().optional().default(""),
          price: z.number().positive().max(999999.99),
          category: z.string().min(1).max(80).trim(),
          tags: z.array(z.string().trim().min(1)).max(20).optional().default([]),
        })
      )
      .max(500)
      .optional()
      .default([]),
    combos: z
      .array(
        z.object({
          name: z.string().min(2).max(120).trim(),
          description: z.string().max(2000).trim().optional().default(""),
          comboPrice: z.number().positive().max(999999.99),
          itemNames: z.array(z.string().trim().min(1)).min(2).max(20),
        })
      )
      .max(100)
      .optional()
      .default([]),
  })
  .refine((d) => d.items.length + d.combos.length > 0, {
    message: "Nothing to commit",
  });

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
