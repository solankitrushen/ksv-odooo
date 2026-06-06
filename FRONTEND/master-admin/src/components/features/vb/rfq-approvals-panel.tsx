"use client";

import {
  AiRecommendationBadge,
  ApprovalStatusBadge,
  QuotationStatusBadge,
} from "@/components/features/vb/status-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useApproveQuotation,
  useAutoReview,
  useBargainQuotation,
  useDownloadInvoice,
  useRejectQuotation,
} from "@/hooks/vb/use-approvals";
import {
  useDownloadStaffQuotation,
  useStaffRfqQuotations,
} from "@/hooks/vb/use-quotations";
import { formatPaise } from "@/lib/money";
import type { Quotation, Vendor } from "@/lib/vb-types";
import {
  CheckCircle2,
  Download,
  FileText,
  Handshake,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

interface Props {
  rfqId: string;
  rfqReference: string;
  vendors: Vendor[];
}

export function RfqApprovalsPanel({ rfqId, rfqReference, vendors }: Props) {
  const { data: quotations, isLoading } = useStaffRfqQuotations(rfqId);
  const autoReview = useAutoReview();
  const approve = useApproveQuotation();
  const reject = useRejectQuotation();
  const bargain = useBargainQuotation();
  const downloadInvoice = useDownloadInvoice();
  const downloadQuote = useDownloadStaffQuotation();

  const [rejecting, setRejecting] = useState<Quotation | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const vendorById = useMemo(() => {
    const m = new Map<string, Vendor>();
    for (const v of vendors) m.set(v._id, v);
    return m;
  }, [vendors]);

  const rows = quotations ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Quotations & approvals</CardTitle>
          <CardDescription>
            Run AI auto-review to score every submitted quote, then approve
            (auto-generates an invoice), reject, or send an AI bargaining
            request.
          </CardDescription>
        </div>
        <Button
          disabled={autoReview.isPending || rows.length === 0}
          onClick={() => autoReview.mutate(rfqId)}
          size="sm"
        >
          <Sparkles className="h-4 w-4" />
          {autoReview.isPending ? "Reviewing…" : "AI auto-review"}
        </Button>
      </CardHeader>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1].map((i) => (
            <Skeleton className="h-12 w-full" key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          No submitted quotations yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Grand total</TableHead>
                <TableHead>Cover</TableHead>
                <TableHead>AI score</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((q) => {
                const v = vendorById.get(q.vendorId);
                const approval = q.approval;
                const decided =
                  approval?.status === "approved" ||
                  approval?.status === "rejected";
                const isSubmitted = q.status === "submitted";
                return (
                  <TableRow key={q._id}>
                    <TableCell className="font-medium text-foreground">
                      {v?.name ?? q.vendorId}
                      <span className="ml-2">
                        <QuotationStatusBadge status={q.status} />
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPaise(q.computed?.grandTotal, q.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {Math.round((q.computed?.coverage ?? 0) * 100)}%
                    </TableCell>
                    <TableCell>
                      {approval?.aiScore != null ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {approval.aiScore}
                          </span>
                          {approval.aiRecommendation && (
                            <AiRecommendationBadge
                              recommendation={approval.aiRecommendation}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          not reviewed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ApprovalStatusBadge
                        status={approval?.status ?? "pending"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        {isSubmitted && !decided && (
                          <>
                            <Button
                              disabled={approve.isPending}
                              onClick={() =>
                                approve.mutate({ rfqId, id: q._id })
                              }
                              size="sm"
                              variant="ghost"
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              Approve
                            </Button>
                            <Button
                              disabled={bargain.isPending}
                              onClick={() =>
                                bargain.mutate({ rfqId, id: q._id })
                              }
                              size="sm"
                              variant="ghost"
                            >
                              <Handshake className="h-4 w-4" />
                              Bargain
                            </Button>
                            <Button
                              onClick={() => {
                                setRejecting(q);
                                setRejectReason("");
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                              Reject
                            </Button>
                          </>
                        )}
                        {approval?.status === "approved" && (
                          <Button
                            disabled={downloadInvoice.isPending}
                            onClick={() =>
                              downloadInvoice.mutate({
                                rfqId,
                                id: q._id,
                                filename: `invoice-${rfqReference}-${
                                  v?.name ?? "vendor"
                                }.pdf`,
                              })
                            }
                            size="sm"
                            variant="ghost"
                          >
                            <FileText className="h-4 w-4" />
                            Invoice
                          </Button>
                        )}
                        <Button
                          disabled={downloadQuote.isPending}
                          onClick={() =>
                            downloadQuote.mutate({
                              rfqId,
                              id: q._id,
                              filename: `${rfqReference}-${v?.name ?? "vendor"}.pdf`,
                            })
                          }
                          size="sm"
                          variant="ghost"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        onOpenChange={(o) => !o && setRejecting(null)}
        open={Boolean(rejecting)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              The vendor is notified by email. Optionally include a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={3}
            value={rejectReason}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reject.isPending}
              onClick={async () => {
                if (!rejecting) return;
                await reject.mutateAsync({
                  rfqId,
                  id: rejecting._id,
                  reason: rejectReason.trim() || undefined,
                });
                setRejecting(null);
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
