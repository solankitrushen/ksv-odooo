"use client";

import { AiRecommendationBadge } from "@/components/features/vb/status-badges";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";
import type { CompareResponse } from "@/lib/vb-types";
import { format } from "date-fns";
import { Trophy } from "lucide-react";

interface Props {
  data: CompareResponse;
}

/**
 * Vendor-by-line-item price comparison matrix.
 * - Rows = RFQ line items, columns = vendor quotations.
 * - Each cell renders the quoted unit price (integer paise → formatPaise).
 * - The lowest price per row (cell.quotationId === item.bestQuotationId) is
 *   highlighted green.
 * - The column whose _id === lowestTotalQuotationId is flagged "Lowest total".
 */
export function QuotationCompareMatrix({ data }: Props) {
  const { items, quotations, lowestTotalQuotationId } = data;

  if (quotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
        <h3 className="text-sm font-semibold text-foreground">
          No quotations submitted yet
        </h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          Vendors have not submitted any quotations for this RFQ. Once they do,
          a side-by-side price comparison appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
      <Table>
        <TableHeader>
          {/* Vendor header row: name + lowest-total flag */}
          <TableRow>
            <TableHead className="min-w-[200px] align-bottom">
              Line item
            </TableHead>
            {quotations.map((q) => {
              const isLowest =
                lowestTotalQuotationId != null &&
                q._id === lowestTotalQuotationId;
              return (
                <TableHead className="min-w-[180px] align-top" key={q._id}>
                  <div className="space-y-1.5 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {q.vendor?.name ?? q.vendorId}
                      </span>
                      {isLowest && (
                        <Badge className="gap-1 border-green-600/40 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          <Trophy className="h-3 w-3" />
                          Lowest total
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatPaise(q.computed?.grandTotal, q.currency)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground">
                      {q.approval?.aiScore != null && (
                        <span className="font-medium text-foreground">
                          AI {q.approval.aiScore}
                        </span>
                      )}
                      {q.approval?.aiRecommendation && (
                        <AiRecommendationBadge
                          recommendation={q.approval.aiRecommendation}
                        />
                      )}
                    </div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {q.terms?.deliveryDate
                        ? `Delivery ${format(
                            new Date(q.terms.deliveryDate),
                            "MMM d, yyyy"
                          )}`
                        : "Delivery —"}
                    </div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {q.terms?.paymentDays != null
                        ? `${q.terms.paymentDays} day payment terms`
                        : "Payment terms —"}
                    </div>
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.rfqItemId}>
              <TableCell className="align-top">
                <div className="font-medium text-foreground">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.qty} {item.unit}
                </div>
              </TableCell>
              {quotations.map((q) => {
                const cell = item.prices.find((p) => p.quotationId === q._id);
                const isBest =
                  item.bestQuotationId != null &&
                  cell?.quotationId === item.bestQuotationId &&
                  cell?.unitPrice != null;
                return (
                  <TableCell
                    className={cn(
                      "align-top tabular-nums",
                      isBest &&
                        "bg-green-100 font-semibold text-green-900 dark:bg-green-900/30 dark:text-green-200"
                    )}
                    key={q._id}
                  >
                    {cell?.unitPrice != null ? (
                      <div>
                        <div>{formatPaise(cell.unitPrice, q.currency)}</div>
                        {cell.lineTotal != null && (
                          <div className="text-xs font-normal text-muted-foreground">
                            {formatPaise(cell.lineTotal, q.currency)} total
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        not quoted
                      </span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
