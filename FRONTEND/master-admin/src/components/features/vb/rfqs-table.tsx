"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  QuotationStatusBadge,
  RfqPriorityBadge,
  RfqStatusBadge,
} from "@/components/features/vb/status-badges";
import type { QuotationStatus, Rfq } from "@/lib/vb-types";
import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { ExternalLink, FileText, Sparkles } from "lucide-react";
import Link from "next/link";

type RfqRow = Rfq & {
  myQuotation?: { status: QuotationStatus } | null;
};

interface Props {
  rfqs: RfqRow[];
  /** Vendor mode: action becomes "Build quotation" → quote workspace. */
  vendor?: boolean;
}

function deadlineLabel(deadline: string) {
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return "—";
  if (isPast(d)) return `Closed ${formatDistanceToNowStrict(d)} ago`;
  return `in ${formatDistanceToNowStrict(d)}`;
}

export function RfqsTable({ rfqs, vendor = false }: Props) {
  if (rfqs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {vendor ? "No RFQs assigned to you" : "No RFQs yet"}
        </h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          {vendor
            ? "When a buyer assigns you an RFQ, it appears here to reply with a quotation."
            : "Create a request for quotation to invite vendors to bid. Drafts and active RFQs appear here."}
        </p>
        {!vendor && (
          <Link href="/rfqs/new">
            <Button size="sm">Create RFQ</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rfqs.map((rfq) => (
            <TableRow key={rfq._id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {rfq.reference}
              </TableCell>
              <TableCell className="font-medium text-foreground">
                {rfq.title}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {rfq.category}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {rfq.items?.length ?? 0}
              </TableCell>
              <TableCell>
                <RfqPriorityBadge priority={rfq.priority} />
              </TableCell>
              <TableCell>
                <RfqStatusBadge status={rfq.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <span className="block">
                  {format(new Date(rfq.deadline), "MMM d, yyyy p")}
                </span>
                <span>{deadlineLabel(rfq.deadline)}</span>
              </TableCell>
              <TableCell className="text-right">
                {vendor ? (
                  rfq.myQuotation ? (
                    <div className="flex items-center justify-end gap-2">
                      <QuotationStatusBadge status={rfq.myQuotation.status} />
                      <Link href={`/rfqs/${rfq._id}/quote`}>
                        <Button size="sm" variant="outline">
                          Open quote
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Link href={`/rfqs/${rfq._id}/quote`}>
                      <Button size="sm">
                        <Sparkles className="h-4 w-4" />
                        Build quotation
                      </Button>
                    </Link>
                  )
                ) : (
                  <Link href={`/rfqs/${rfq._id}`}>
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="h-4 w-4" />
                      View
                    </Button>
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
