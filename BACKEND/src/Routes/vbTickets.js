import { Router } from "express";
import { VB_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import { validate } from "../Validators/authValidator.js";
import {
  createTicketSchema,
  ticketReplySchema,
} from "../Validators/workflowValidator.js";
import {
  listTickets,
  getTicket,
  createTicketHandler,
  replyTicket,
  closeTicketHandler,
} from "../Controllers/ticketController.js";

const STAFF = [VB_ROLES.ADMIN, VB_ROLES.OFFICER, VB_ROLES.MANAGER];

const router = Router();
router.use(authMiddleware, tenantContext, roleMiddleware(STAFF));

router.get("/", asyncHandler(listTickets));
router.post("/", validate(createTicketSchema), asyncHandler(createTicketHandler));
router.get("/:id", asyncHandler(getTicket));
router.post("/:id/reply", validate(ticketReplySchema), asyncHandler(replyTicket));
router.post("/:id/close", asyncHandler(closeTicketHandler));

export default router;
