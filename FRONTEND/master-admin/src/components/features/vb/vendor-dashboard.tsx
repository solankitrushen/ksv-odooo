"use client";

import { KpiCard } from "@/components/features/dashboard/kpi-card";
import {
  ApprovalStatusBadge,
  QuotationStatusBadge,
  RfqPriorityBadge,
} from "@/components/features/vb/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useVendorDashboard } from "@/hooks/vb/use-vb-analytics";
import { formatPaise } from "@/lib/money";
import { format } from "date-fns";
import {
  AlertTriangle,
  FileText,
  IndianRupee,
  Send,
  Trophy,
} from "lucide-react";
import Link from "next/link";

export function VendorDashboard() {
  const { data, error, isError, isLoading, refetch } = useVendorDashboard();

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to load your dashboard</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{error?.message || "Unknown error"}</span>
          <Button onClick={() => refetch()} size="sm" variant="outline">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const d = data;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          hint="RFQs awaiting your quote"
          icon={FileText}
          label="Assigned RFQs"
          loading={isLoading}
          value={d ? String(d.rfqs.assigned) : "—"}
        />
        <KpiCard
          hint={d ? `${d.quotations.draft} draft in progress` : ""}
          icon={Send}
          label="Quotations submitted"
          loading={isLoading}
          value={d ? String(d.quotations.submitted) : "—"}
        />
        <KpiCard
          hint={d ? `${d.won.count} approved` : ""}
          icon={Trophy}
          label="Won value"
          loading={isLoading}
          value={d ? formatPaise(d.won.value) : "—"}
        />
        <KpiCard
          hint={d ? `${d.invoices} invoice(s)` : ""}
          icon={IndianRupee}
          label="Purchase orders"
          loading={isLoading}
          value={d ? String(d.purchaseOrders) : "—"}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Your assigned RFQs</CardTitle>
          <Link href="/rfqs">
            <Button size="sm" variant="ghost">
              View all
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton className="h-10 w-full" key={i} />
              ))}
            </div>
          ) : (d?.recentRfqs ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No RFQs assigned to you yet. When a buyer assigns you an RFQ, it
              shows up here to quote on.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Your quote</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(d?.recentRfqs ?? []).map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.reference}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium text-foreground">
                      {r.title}
                    </TableCell>
                    <TableCell>
                      <RfqPriorityBadge priority={r.priority} />
                    </TableCell>
                    <TableCell>
                      {r.myQuotation ? (
                        <div className="flex items-center gap-1.5">
                          <QuotationStatusBadge
                            status={
                              r.myQuotation.status as
                                | "draft"
                                | "submitted"
                                | "withdrawn"
                                | "expired"
                            }
                          />
                          {r.myQuotation.status === "submitted" && (
                            <ApprovalStatusBadge
                              status={
                                r.myQuotation.approvalStatus as
                                  | "pending"
                                  | "approved"
                                  | "rejected"
                              }
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          not started
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.deadline), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/rfqs/${r._id}/quote`}>
                        <Button size="sm" variant="ghost">
                          {r.myQuotation ? "Open quote" : "Build quote"}
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
