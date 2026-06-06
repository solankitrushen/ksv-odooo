"use client";

import { Badge } from "@/components/ui/badge";
import type {
  AiRecommendation,
  QuotationApprovalStatus,
  QuotationStatus,
  RfqPriority,
  RfqStatus,
  TicketStatus,
  VendorStatus,
} from "@/lib/vb-types";

type Variant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

const VENDOR_MAP: Record<VendorStatus, { variant: Variant; label: string }> = {
  invited: { variant: "warning", label: "Invited" },
  active: { variant: "success", label: "Active" },
  inactive: { variant: "destructive", label: "Inactive" },
};

const RFQ_MAP: Record<RfqStatus, { variant: Variant; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  active: { variant: "success", label: "Active" },
  closed: { variant: "outline", label: "Closed" },
};

const RFQ_PRIORITY_MAP: Record<RfqPriority, { variant: Variant; label: string }> =
  {
    low: { variant: "outline", label: "Low" },
    medium: { variant: "secondary", label: "Medium" },
    high: { variant: "warning", label: "High" },
  };

const QUOTATION_MAP: Record<
  QuotationStatus,
  { variant: Variant; label: string }
> = {
  draft: { variant: "secondary", label: "Draft" },
  submitted: { variant: "success", label: "Submitted" },
  withdrawn: { variant: "destructive", label: "Withdrawn" },
  expired: { variant: "outline", label: "Expired" },
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  const m = VENDOR_MAP[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function RfqStatusBadge({ status }: { status: RfqStatus }) {
  const m = RFQ_MAP[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function RfqPriorityBadge({ priority }: { priority: RfqPriority }) {
  const m =
    RFQ_PRIORITY_MAP[priority] ?? { variant: "outline" as const, label: priority };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const m =
    QUOTATION_MAP[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

const APPROVAL_MAP: Record<
  QuotationApprovalStatus,
  { variant: Variant; label: string }
> = {
  pending: { variant: "warning", label: "Pending" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

const RECOMMENDATION_MAP: Record<
  AiRecommendation,
  { variant: Variant; label: string }
> = {
  approve: { variant: "success", label: "AI: Approve" },
  review: { variant: "warning", label: "AI: Review" },
  reject: { variant: "destructive", label: "AI: Reject" },
};

const TICKET_MAP: Record<TicketStatus, { variant: Variant; label: string }> = {
  open: { variant: "secondary", label: "Open" },
  awaiting_vendor: { variant: "warning", label: "Awaiting vendor" },
  awaiting_admin: { variant: "default", label: "Awaiting admin" },
  resolved: { variant: "success", label: "Resolved" },
  closed: { variant: "outline", label: "Closed" },
};

export function ApprovalStatusBadge({
  status,
}: {
  status: QuotationApprovalStatus;
}) {
  const m =
    APPROVAL_MAP[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function AiRecommendationBadge({
  recommendation,
}: {
  recommendation: AiRecommendation;
}) {
  const m =
    RECOMMENDATION_MAP[recommendation] ?? {
      variant: "outline" as const,
      label: recommendation,
    };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const m = TICKET_MAP[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
