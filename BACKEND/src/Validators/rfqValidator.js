import { z } from "zod";
import { RFQ_PRIORITY, RFQ_STATUS } from "../../config/constants.js";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

const rfqItem = z.object({
  name: z.string().min(1).max(200).trim(),
  qty: z.number().positive().max(1000000),
  unit: z.string().min(1).max(30).trim(),
});

export const createRfqSchema = z
  .object({
    title: z.string().min(2).max(200).trim(),
    category: z.string().min(1).max(80).trim(),
    deadline: z.coerce.date(),
    items: z.array(rfqItem).min(1).max(200),
    description: z.string().max(5000).trim().optional().default(""),
    attachmentUrl: z.string().url().max(2000).optional(),
    priority: z.nativeEnum(RFQ_PRIORITY).optional(),
    assignedVendorIds: z.array(objectId).max(100).optional().default([]),
    status: z
      .enum([RFQ_STATUS.DRAFT, RFQ_STATUS.ACTIVE])
      .optional()
      .default(RFQ_STATUS.DRAFT),
  })
  .refine((d) => d.deadline.getTime() > Date.now(), {
    message: "Deadline must be in the future",
    path: ["deadline"],
  })
  .refine(
    (d) => d.status !== RFQ_STATUS.ACTIVE || d.assignedVendorIds.length > 0,
    {
      message: "An active RFQ needs at least one assigned vendor",
      path: ["assignedVendorIds"],
    }
  );

export const listRfqQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
  status: z.nativeEnum(RFQ_STATUS).optional(),
});
