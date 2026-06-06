import { Router } from "express";
import { createRfq, getRfq, listRfqs } from "../Controllers/rfqController.js";
import {
  staffListQuotations,
  staffDownloadQuotation,
} from "../Controllers/quotationController.js";
import {
  autoReview,
  approveQuotation,
  rejectQuotation,
  bargainQuotation,
  compareQuotations,
  downloadInvoice,
} from "../Controllers/vbApprovalController.js";
import { decisionSchema } from "../Validators/workflowValidator.js";
import { VB_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { createRfqSchema, listRfqQuerySchema } from "../Validators/rfqValidator.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import { validate } from "../Validators/authValidator.js";
import { validateQuery } from "../Validators/inventoryValidator.js";

const ALL = [VB_ROLES.ADMIN, VB_ROLES.OFFICER, VB_ROLES.MANAGER, VB_ROLES.VENDOR];
const STAFF = [VB_ROLES.ADMIN, VB_ROLES.OFFICER];
const STAFF_ALL = [VB_ROLES.ADMIN, VB_ROLES.OFFICER, VB_ROLES.MANAGER];

const router = Router();

router.use(authMiddleware, tenantContext);

router.post("/", roleMiddleware(STAFF), validate(createRfqSchema), asyncHandler(createRfq));
router.get("/", roleMiddleware(ALL), validateQuery(listRfqQuerySchema), asyncHandler(listRfqs));
router.get("/:id", roleMiddleware(ALL), asyncHandler(getRfq));

// Staff: all submitted/withdrawn quotations for an RFQ (FR-11) + PDF download (AI FR-9)
router.get("/:id/quotations", roleMiddleware(STAFF_ALL), asyncHandler(staffListQuotations));
router.get(
  "/:rfqId/quotations/:id/download",
  roleMiddleware(STAFF_ALL),
  asyncHandler(staffDownloadQuotation)
);

// --- SPEC-VB-005 approval + AI review + bargaining + invoices (staff) ---
router.post("/:rfqId/auto-review", roleMiddleware(STAFF_ALL), asyncHandler(autoReview));
router.get("/:rfqId/compare", roleMiddleware(STAFF_ALL), asyncHandler(compareQuotations));
router.post(
  "/:rfqId/quotations/:id/approve",
  roleMiddleware(STAFF),
  validate(decisionSchema),
  asyncHandler(approveQuotation)
);
router.post(
  "/:rfqId/quotations/:id/reject",
  roleMiddleware(STAFF),
  validate(decisionSchema),
  asyncHandler(rejectQuotation)
);
router.post(
  "/:rfqId/quotations/:id/bargain",
  roleMiddleware(STAFF),
  asyncHandler(bargainQuotation)
);
router.get(
  "/:rfqId/quotations/:id/invoice",
  roleMiddleware(STAFF_ALL),
  asyncHandler(downloadInvoice)
);

export default router;
