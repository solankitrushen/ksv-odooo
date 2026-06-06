import { z } from "zod";

export const dashboardQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const failedOrdersQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  category: z
    .enum(["rejected_by_store", "cancelled_by_user", "payment_failed", "unknown"])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const failureReviewSchema = z.object({
  notes: z.string().max(1000).trim().optional().default(""),
});

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res
        .status(400)
        .json({ success: false, error: "Validation failed", details });
    }
    req.validatedQuery = result.data;
    next();
  };
}

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res
        .status(400)
        .json({ success: false, error: "Validation failed", details });
    }
    req.validated = result.data;
    next();
  };
}
