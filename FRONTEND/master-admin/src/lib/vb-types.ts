// ---------------------------------------------------------------------------
// VendorBridge (VB) type contracts — mirror BACKEND/src/Schema + Validators.
// Money is stored as INTEGER PAISE on the wire. Convert at the UI edge with the
// helpers in `@/lib/money`.
// ---------------------------------------------------------------------------

// ---- Enums (mirror config/constants.js) -----------------------------------

export const VB_ROLES = {
  ADMIN: "admin",
  OFFICER: "officer",
  MANAGER: "manager",
  VENDOR: "vendor",
} as const;
export type VbRole = (typeof VB_ROLES)[keyof typeof VB_ROLES];

export const VENDOR_STATUS = {
  INVITED: "invited",
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;
export type VendorStatus = (typeof VENDOR_STATUS)[keyof typeof VENDOR_STATUS];

export const RFQ_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  CLOSED: "closed",
} as const;
export type RfqStatus = (typeof RFQ_STATUS)[keyof typeof RFQ_STATUS];

export const RFQ_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;
export type RfqPriority = (typeof RFQ_PRIORITY)[keyof typeof RFQ_PRIORITY];

export const QUOTATION_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  WITHDRAWN: "withdrawn",
  EXPIRED: "expired",
} as const;
export type QuotationStatus =
  (typeof QUOTATION_STATUS)[keyof typeof QUOTATION_STATUS];

export const QUOTATION_SOURCE = {
  MANUAL: "manual",
  AI_GENERATED: "ai-generated",
  AI_ENHANCED: "ai-enhanced",
  CSV_IMPORT: "csv-import",
  PDF_EXTRACT: "pdf-extract",
} as const;
export type QuotationSource =
  (typeof QUOTATION_SOURCE)[keyof typeof QUOTATION_SOURCE];

export const AI_SESSION_MODE = {
  GENERATE: "generate",
  ENHANCE: "enhance",
} as const;
export type AiSessionMode =
  (typeof AI_SESSION_MODE)[keyof typeof AI_SESSION_MODE];

export const AI_SESSION_STATUS = {
  OPEN: "open",
  ANSWERED: "answered",
  DRAFTED: "drafted",
  CLOSED: "closed",
} as const;
export type AiSessionStatus =
  (typeof AI_SESSION_STATUS)[keyof typeof AI_SESSION_STATUS];

export type AiQuestionKind =
  | "money"
  | "int"
  | "date"
  | "enum"
  | "text"
  | "bool";

export type AiSuggestionSeverity = "info" | "warn" | "high";

// ---- Vendor ----------------------------------------------------------------

export interface Vendor {
  _id: string;
  tenantId: string;
  name: string;
  category: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  gstNumber?: string;
  status: VendorStatus;
  userId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorInput {
  name: string;
  category: string;
  email: string;
  contactPerson?: string;
  phone?: string;
  gstNumber?: string;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

export interface ListVendorsResponse {
  items: Vendor[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface VendorResponse {
  vendor: Vendor;
}

export interface CreateVendorResponse {
  vendor: Vendor;
  emailSent?: boolean;
  accountExisted?: boolean;
  credentials: {
    email: string;
    portalUrl: string;
    tempPassword?: string;
  };
}

// ---- RFQ -------------------------------------------------------------------

export interface RfqItem {
  name: string;
  qty: number;
  unit: string;
}

export interface Rfq {
  _id: string;
  tenantId: string;
  reference: string;
  title: string;
  category: string;
  requestDate?: string;
  deadline: string;
  items: RfqItem[];
  description?: string;
  attachmentUrl?: string | null;
  priority: RfqPriority;
  assignedVendors: string[];
  status: RfqStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRfqInput {
  title: string;
  category: string;
  deadline: string; // ISO
  items: RfqItem[];
  description?: string;
  attachmentUrl?: string;
  priority?: RfqPriority;
  assignedVendorIds?: string[];
  status?: "draft" | "active";
}

export interface ListRfqsResponse {
  items: Rfq[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface RfqResponse {
  rfq: Rfq;
}

/** Vendor RFQ inbox row — RFQ + the vendor's own quotation summary. */
export interface VendorRfqInboxItem extends Rfq {
  myQuotation: {
    _id?: string;
    rfqId: string;
    status: QuotationStatus;
    computed?: { grandTotal?: number; coverage?: number };
    updatedAt?: string;
  } | null;
}

export interface VendorRfqInboxResponse {
  items: VendorRfqInboxItem[];
  total: number;
}

export interface VendorRfqDetailResponse {
  rfq: Rfq;
  myQuotation: Quotation | null;
}

// ---- Quotation -------------------------------------------------------------

export interface QuotationItem {
  rfqItemId: string | null;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number | null; // paise
  taxRatePct: number | string; // Decimal128 may serialize as string
  discountPct: number | string;
  hsnCode?: string | null;
  notes?: string;
  lineTotal: number; // paise, server-computed
}

export interface QuotationTerms {
  paymentDays?: number | null;
  deliveryDate?: string | null;
  deliveryWindowText?: string;
  warrantyMonths?: number | null;
  minOrderQty?: number | null;
  freeText?: string;
}

export interface QuotationComputed {
  subtotal: number; // paise
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  coverage: number; // 0..1
  partial: boolean;
}

export interface Quotation {
  _id: string;
  tenantId: string;
  rfqId: string;
  vendorId: string;
  vendorUserId: string;
  status: QuotationStatus;
  currency: string;
  items: QuotationItem[];
  terms: QuotationTerms;
  computed: QuotationComputed;
  approval?: QuotationApproval;
  deadline: string;
  submittedAt?: string | null;
  withdrawnAt?: string | null;
  withdrawReason?: string | null;
  rfqVersionNumber?: number;
  staleFlag?: boolean;
  source: QuotationSource;
  aiSessionId?: string | null;
  revisionOf?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type QuotationApprovalStatus = "pending" | "approved" | "rejected";
export type AiRecommendation = "approve" | "review" | "reject";

export interface QuotationApproval {
  status: QuotationApprovalStatus;
  aiScore?: number | null;
  aiRecommendation?: AiRecommendation | null;
  aiFindings?: string[];
  aiReviewedAt?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  reason?: string | null;
  invoiceId?: string | null;
}

/** Per-line PRICING ONLY payload — identity is server-seeded from the RFQ. */
export interface QuotationPricingItem {
  rfqItemId: string;
  unitPrice?: number | null; // paise
  taxRatePct?: number;
  discountPct?: number;
  hsnCode?: string | null;
  notes?: string;
}

export interface QuotationTermsInput {
  paymentDays?: number | null;
  deliveryDate?: string | null;
  deliveryWindowText?: string;
  warrantyMonths?: number | null;
  minOrderQty?: number | null;
  freeText?: string;
}

export interface CreateQuotationInput {
  rfqId: string;
  currency?: string;
  items?: QuotationPricingItem[];
  terms?: QuotationTermsInput;
  aiSessionId?: string;
}

export interface PatchQuotationInput {
  currency?: string;
  items?: QuotationPricingItem[];
  terms?: QuotationTermsInput;
}

export interface QuotationResponse {
  quotation: Quotation;
}

export interface StaffQuotationsResponse {
  items: Quotation[];
  total: number;
}

// ---- AI co-pilot -----------------------------------------------------------

export interface AiQuestion {
  id: string;
  prompt: string;
  kind: AiQuestionKind;
  field: string;
  rfqItemId?: string | null;
  options?: string[];
  min?: number | null;
  max?: number | null;
  required?: boolean;
}

export type AiAnswerValue = string | number | boolean | null;

export interface AiAnswer {
  questionId: string;
  value: AiAnswerValue;
  answeredAt?: string;
}

export interface AiSuggestion {
  id: string;
  type: string; // unpriced_item | late_delivery | price_vs_peer | missing_terms ...
  field?: string | null;
  rfqItemId?: string | null;
  current?: unknown;
  proposed?: unknown;
  rationale?: string;
  severity: AiSuggestionSeverity;
}

export interface AiQuotationSession {
  _id: string;
  tenantId: string;
  rfqId: string;
  vendorId: string;
  vendorUserId: string;
  mode: AiSessionMode;
  status: AiSessionStatus;
  provider: string;
  questions: AiQuestion[];
  answers: AiAnswer[];
  draftQuotationId?: string | null;
  lastScore?: number | null;
  suggestions: AiSuggestion[];
  findings: string[];
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiSessionResponse {
  session: AiQuotationSession;
}

export interface AiGenerateResponse {
  quotation: Quotation;
  candidate: {
    items?: Array<{ rfqItemId: string; unitPrice?: number | null }>;
    terms?: QuotationTermsInput;
    currency?: string;
  };
}

export interface AiEnhanceResponse {
  score: number; // 0..100
  findings: string[];
  suggestions: AiSuggestion[];
  peerStatsAvailable: boolean;
}

export interface AiApplyInput {
  suggestionIds: string[];
}

// ---- Analytics -------------------------------------------------------------

export interface VbAnalyticsDashboard {
  vendors: { active: number; invited: number; inactive: number; total: number };
  rfqs: { draft: number; active: number; closed: number; total: number };
  quotations: {
    draft: number;
    submitted: number;
    withdrawn: number;
    expired: number;
    total: number;
  };
  cost: {
    totalSubmittedValue: number; // paise
    avgSubmittedValue: number; // paise
    avgCoverage: number; // 0..1
    submittedCount: number;
  };
  recentRfqs: Array<{
    _id: string;
    reference: string;
    title: string;
    status: RfqStatus;
    priority: RfqPriority;
    deadline: string;
    createdAt: string;
  }>;
  recentSubmissions: Array<{
    _id: string;
    rfqId: string;
    vendorId: string;
    status: QuotationStatus;
    currency: string;
    submittedAt?: string;
    computed?: { grandTotal?: number; coverage?: number };
    vendor: { _id: string; name: string; category: string } | null;
    rfq: { _id: string; reference: string; title: string } | null;
  }>;
  topVendors: Array<{
    vendorId: string;
    vendor: { _id: string; name: string; category: string } | null;
    totalValue: number; // paise
    submissions: number;
  }>;
}

// ---- Approval / review ------------------------------------------------------

export interface AutoReviewResultRow {
  quotationId: string;
  vendorId: string;
  aiScore: number | null;
  aiRecommendation: AiRecommendation | null;
  findings: string[];
  skipped?: boolean;
}

export interface AutoReviewResponse {
  reviewed: number;
  results: AutoReviewResultRow[];
}

// ---- Invoice ----------------------------------------------------------------

export type InvoiceStatus = "issued" | "paid" | "cancelled";

export interface Invoice {
  _id: string;
  tenantId: string;
  number: string;
  rfqId: string;
  quotationId: string;
  vendorId: string;
  currency: string;
  items: Array<{
    name: string;
    qty: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  status: InvoiceStatus;
  issuedBy: string;
  issuedAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApproveResponse {
  quotation: Quotation;
  invoice: Invoice;
}

// ---- Tickets ----------------------------------------------------------------

export type TicketStatus =
  | "open"
  | "awaiting_vendor"
  | "awaiting_admin"
  | "resolved"
  | "closed";

export type TicketType = "bargain" | "query" | "general";

export interface TicketMessage {
  authorRole: "admin" | "vendor" | "ai";
  authorId?: string | null;
  body: string;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  tenantId: string;
  reference: string;
  rfqId: string;
  quotationId?: string | null;
  vendorId: string;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  priority: "low" | "medium" | "high";
  aiGenerated: boolean;
  targetUnitPrices?: Record<string, number>;
  messages: TicketMessage[];
  createdBy: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  vendor?: { _id: string; name: string; email?: string } | null;
  rfq?: { _id: string; reference: string; title: string } | null;
}

export interface ListTicketsResponse {
  items: Ticket[];
  total: number;
}

export interface TicketResponse {
  ticket: Ticket;
}

export interface CreateTicketInput {
  rfqId: string;
  quotationId?: string;
  vendorId: string;
  type?: TicketType;
  subject: string;
  body?: string;
  priority?: "low" | "medium" | "high";
}

// ---- Purchase orders --------------------------------------------------------

export type PurchaseOrderStatus =
  | "issued"
  | "acknowledged"
  | "fulfilled"
  | "cancelled";

export interface PurchaseOrderItem {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number; // paise
  lineTotal: number; // paise
}

export interface PurchaseOrder {
  _id: string;
  tenantId: string;
  number: string;
  rfqId: string;
  quotationId: string;
  vendorId: string;
  invoiceId?: string;
  currency: string;
  items: PurchaseOrderItem[];
  subtotal: number; // paise
  taxTotal: number; // paise
  discountTotal: number; // paise
  grandTotal: number; // paise
  status: PurchaseOrderStatus;
  issuedAt: string;
  expectedDelivery?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  vendor?: { _id: string; name: string; category: string } | null;
  rfq?: { _id: string; reference: string; title: string } | null;
}

export interface ListPurchaseOrdersResponse {
  items: PurchaseOrder[];
  total: number;
}

// ---- Activity log -----------------------------------------------------------

export type ActivityType =
  | "rfq"
  | "quotation"
  | "approval"
  | "purchase_order"
  | "invoice"
  | "ticket"
  | "vendor";

export interface ActivityLog {
  _id: string;
  type: ActivityType;
  action: string;
  message: string;
  severity: "info" | "success" | "warn" | "error";
  actorRole?: string;
  rfqId?: string;
  vendorId?: string;
  quotationId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface ListActivityResponse {
  items: ActivityLog[];
  total: number;
}

// ---- Reports ----------------------------------------------------------------

export interface ReportsResponse {
  totals: { totalSpend: number; totalOrders: number };
  spendByCategory: { category: string; spend: number }[];
  topVendorsBySpend: {
    vendorId: string;
    vendor: { name: string; category: string } | null;
    spend: number;
    orders: number;
  }[];
  monthlyTrends: { label: string; spend: number; orders: number }[];
}

// ---- Invoice list -----------------------------------------------------------

export interface ListInvoicesResponse {
  items: Invoice[];
  total: number;
}

export interface EmailInvoiceResponse {
  message: string;
}

// ---- Quotation comparison ---------------------------------------------------

export interface ComparePriceCell {
  quotationId: string;
  vendorId: string;
  unitPrice: number | null; // paise
  lineTotal: number | null; // paise
}

export interface CompareItem {
  rfqItemId: string;
  name: string;
  qty: number;
  unit: string;
  prices: ComparePriceCell[];
  bestQuotationId: string | null;
}

export interface CompareQuotation {
  _id: string;
  vendorId: string;
  vendor: { name: string; category: string } | null;
  currency: string;
  computed: QuotationComputed;
  terms: {
    deliveryDate?: string | null;
    paymentDays?: number | null;
    warrantyMonths?: number | null;
  };
  approval: {
    status: QuotationApprovalStatus;
    aiScore?: number | null;
    aiRecommendation?: AiRecommendation | null;
  };
}

export interface CompareResponse {
  rfq: { _id: string; reference: string; title: string; deadline: string };
  quotations: CompareQuotation[];
  items: CompareItem[];
  lowestTotalQuotationId: string | null;
}

// ---- Assistant --------------------------------------------------------------

export interface AssistantResponse {
  reply: string;
  suggestions: string[];
  snapshot: Record<string, unknown>;
}
