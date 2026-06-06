import { Router } from "express";
import rateLimit from "express-rate-limit";
import { VB_ROLES, QUOTATION_AI_CONFIG } from "../../config/constants.js";
import { asyncHandler } from "../Utils/asyncHandler.js";
import { authMiddleware } from "../Middleware/authMiddleware.js";
import { roleMiddleware } from "../Middleware/roleMiddleware.js";
import { tenantContext } from "../Middleware/tenantContext.js";
import { validate } from "../Validators/authValidator.js";
import {
  createQuotationSchema,
  patchQuotationSchema,
  withdrawQuotationSchema,
  aiStartSessionSchema,
  aiAnswersSchema,
  aiApplySchema,
} from "../Validators/quotationValidator.js";
import {
  createQuotation,
  patchQuotation,
  getQuotation,
  submitQuotation,
  withdrawQuotation,
  reaffirmQuotation,
  resubmitQuotation,
  downloadOwnQuotation,
} from "../Controllers/quotationController.js";
import {
  startSession,
  answerSession,
  generateDraft,
  enhanceQuotation,
  applySuggestions,
} from "../Controllers/quotationAiController.js";

const VENDOR = [VB_ROLES.VENDOR];
const isTest = () => process.env.NODE_ENV === "test";

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: QUOTATION_AI_CONFIG.ratePerMin,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
});
const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: isTest,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
router.use(authMiddleware, tenantContext, roleMiddleware(VENDOR));

// --- AI sessions (literal "ai" segment first to avoid :id capture) ---
router.post("/ai/sessions", aiLimiter, validate(aiStartSessionSchema), asyncHandler(startSession));
router.post("/ai/sessions/:id/answers", aiLimiter, validate(aiAnswersSchema), asyncHandler(answerSession));
router.post("/ai/sessions/:id/generate", aiLimiter, asyncHandler(generateDraft));

// --- core quotation CRUD ---
router.post("/", validate(createQuotationSchema), asyncHandler(createQuotation));
router.get("/:id", asyncHandler(getQuotation));
router.patch("/:id", validate(patchQuotationSchema), asyncHandler(patchQuotation));
router.post("/:id/submit", asyncHandler(submitQuotation));
router.post("/:id/withdraw", validate(withdrawQuotationSchema), asyncHandler(withdrawQuotation));
router.post("/:id/reaffirm", asyncHandler(reaffirmQuotation));
router.post("/:id/resubmit", asyncHandler(resubmitQuotation));
router.get("/:id/download", downloadLimiter, asyncHandler(downloadOwnQuotation));

// --- per-quotation AI ---
router.post("/:id/ai/enhance", aiLimiter, asyncHandler(enhanceQuotation));
router.post("/:id/ai/apply", aiLimiter, validate(aiApplySchema), asyncHandler(applySuggestions));

export default router;
