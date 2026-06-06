"use client";

import { KpiCard } from "@/components/features/dashboard/kpi-card";
import {
  QuotationStatusBadge,
  RfqStatusBadge,
} from "@/components/features/vb/status-badges";
import { VendorFormDialog } from "@/components/features/vb/vendor-form-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { useAuth } from "@/contexts/auth-context";
import { VendorDashboard } from "@/components/features/vb/vendor-dashboard";
import { useVbDashboard } from "@/hooks/vb/use-vb-analytics";
import { formatPaise } from "@/lib/money";
import { format } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  FilePlus2,
  FileText,
  IndianRupee,
  Send,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { setPageTitle } = usePageTitle();
  const { isVendor } = useAuth();
  const { data, error, isError, isLoading, refetch } = useVbDashboard(!isVendor);
  const [vendorOpen, setVendorOpen] = useState(false);

  useEffect(() => {
    setPageTitle({
      description: isVendor
        ? "Your RFQs, quotations, and orders"
        : "Procurement overview — vendors, RFQs, and quoted value",
      title: "Dashboard",
    });
    return () => setPageTitle(null);
  }, [setPageTitle, isVendor]);

  if (isVendor) {
    return <VendorDashboard />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to load dashboard</AlertTitle>
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
      {/* Quick actions — primary tasks reachable in one click */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/rfqs/new">
          <Button>
            <FilePlus2 className="h-4 w-4" />
            New RFQ
          </Button>
        </Link>
        <Button onClick={() => setVendorOpen(true)} variant="outline">
          <Building2 className="h-4 w-4" />
          Add vendor
        </Button>
        <Link href="/reports">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4" />
            View reports
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          hint={
            d ? `${d.vendors.active} active · ${d.vendors.invited} invited` : ""
          }
          icon={Building2}
          label="Vendors"
          loading={isLoading}
          value={d ? String(d.vendors.total) : "—"}
        />
        <KpiCard
          hint={d ? `${d.rfqs.active} active · ${d.rfqs.draft} draft` : ""}
          icon={FileText}
          label="RFQs"
          loading={isLoading}
          value={d ? String(d.rfqs.total) : "—"}
        />
        <KpiCard
          hint={d ? `${d.quotations.draft} draft in progress` : ""}
          icon={Send}
          label="Quotations submitted"
          loading={isLoading}
          value={d ? String(d.quotations.submitted) : "—"}
        />
        <KpiCard
          hint={
            d
              ? `avg ${formatPaise(d.cost.avgSubmittedValue)} per quote`
              : ""
          }
          icon={IndianRupee}
          label="Total quoted value"
          loading={isLoading}
          value={d ? formatPaise(d.cost.totalSubmittedValue) : "—"}
        />
      </div>

      {/* Submission health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            Submission health
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          {isLoading || !d ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">
                  Submitted quotations
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {d.cost.submittedCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Avg item coverage
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {Math.round((d.cost.avgCoverage ?? 0) * 100)}%
                </p>
                <Progress
                  className="mt-2"
                  value={Math.round((d.cost.avgCoverage ?? 0) * 100)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Withdrawn</p>
                <p className="text-xl font-semibold text-foreground">
                  {d.quotations.withdrawn}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent RFQs */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent RFQs</CardTitle>
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
              <p className="p-6 text-sm text-muted-foreground">No RFQs yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(d?.recentRfqs ?? []).map((r) => (
                    <TableRow key={r._id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <Link className="hover:underline" href={`/rfqs/${r._id}`}>
                          {r.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate font-medium text-foreground">
                        {r.title}
                      </TableCell>
                      <TableCell>
                        <RfqStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(r.deadline), "MMM d")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent submissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent submissions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton className="h-10 w-full" key={i} />
                ))}
              </div>
            ) : (d?.recentSubmissions ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No submitted quotations yet. They appear here once vendors submit.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>RFQ</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(d?.recentSubmissions ?? []).map((q) => (
                    <TableRow key={q._id}>
                      <TableCell className="max-w-[120px] truncate font-medium text-foreground">
                        {q.vendor?.name ?? q.vendorId}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {q.rfq ? (
                          <Link
                            className="hover:underline"
                            href={`/rfqs/${q.rfqId}`}
                          >
                            {q.rfq.reference}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPaise(q.computed?.grandTotal, q.currency)}
                      </TableCell>
                      <TableCell>
                        <QuotationStatusBadge status={q.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top vendors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            Top vendors by quoted value
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1].map((i) => (
                <Skeleton className="h-10 w-full" key={i} />
              ))}
            </div>
          ) : (d?.topVendors ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No submitted quotations to rank yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead className="text-right">Total value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(d?.topVendors ?? []).map((t) => (
                  <TableRow key={t.vendorId}>
                    <TableCell className="font-medium text-foreground">
                      {t.vendor?.name ?? t.vendorId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.vendor?.category ?? "—"}
                    </TableCell>
                    <TableCell>{t.submissions}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPaise(t.totalValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <VendorFormDialog onOpenChange={setVendorOpen} open={vendorOpen} />
    </div>
  );
}
