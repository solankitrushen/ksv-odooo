import { z } from "zod";
import { TICKET_TYPE } from "../../config/constants.js";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

export const decisionSchema = z.object({
  reason: z.string().max(1000).trim().optional(),
});

export const createTicketSchema = z.object({
  rfqId: objectId,
  quotationId: objectId.optional(),
  vendorId: objectId,
  type: z.nativeEnum(TICKET_TYPE).optional().default(TICKET_TYPE.GENERAL),
  subject: z.string().min(2).max(200).trim(),
  body: z.string().max(4000).trim().optional(),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
});

export const ticketReplySchema = z.object({
  body: z.string().min(1).max(4000).trim(),
});

export default { decisionSchema, createTicketSchema, ticketReplySchema };
