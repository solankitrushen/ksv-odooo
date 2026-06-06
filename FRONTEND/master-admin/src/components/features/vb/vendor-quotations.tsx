"use client";

import {
  ApprovalStatusBadge,
  QuotationStatusBadge,
} from "@/components/features/vb/status-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTitle } from "@/contexts/page-title-context";
import { useMyQuotations } from "@/hooks/vb/use-vendor-portal";
import { formatPaise } from "@/lib/money";
import { FileText } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export function VendorQuotations() {
  const { setPageTitle } = usePageTitle();
  const { data, isLoading } = useMyQuotations();
  const rows = data ?? [];

  useEffect(() => {
    setPageTitle({ title: "My quotations", description: "Track your submitted quotations" });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <Skeleton className="h-12 w-full" key={i} />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No quotations yet</h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          Go to your RFQs and reply to one with a quotation — the AI co-pilot can
          help you build it. Submitted quotations show up here to track approval.
        </p>
        <Link href="/rfqs"><Button size="sm">Go to my RFQs</Button></Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>RFQ</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead>Coverage</TableHead>
            <TableHead>Grand total</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((q) => (
            <TableRow key={q._id}>
              <TableCell className="font-medium text-foreground">
                <span className="block font-mono text-xs text-muted-foreground">
                  {q.rfq?.reference ?? "—"}
                </span>
                {q.rfq?.title ?? ""}
              </TableCell>
              <TableCell><QuotationStatusBadge status={q.status} /></TableCell>
              <TableCell>
                {q.status === "submitted" && q.approval ? (
                  <ApprovalStatusBadge status={q.approval.status} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {Math.round((q.computed?.coverage ?? 0) * 100)}%
              </TableCell>
              <TableCell className="font-medium">
                {formatPaise(q.computed?.grandTotal, q.currency)}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/rfqs/${q.rfqId}/quote`}>
                  <Button size="sm" variant="ghost">Open</Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
