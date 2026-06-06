"use client";

import { KpiCard } from "@/components/features/dashboard/kpi-card";
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
import { usePageTitle } from "@/contexts/page-title-context";
import { useReports } from "@/hooks/vb/use-reports";
import { formatPaise, paiseToRupees } from "@/lib/money";
import type { ReportsResponse } from "@/lib/vb-types";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Crown,
  Download,
  IndianRupee,
  ShoppingCart,
} from "lucide-react";
import { useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};

function buildCsv(report: ReportsResponse): string {
  const lines: string[] = [];
  lines.push("Spend by category");
  lines.push("Category,Spend (INR)");
  for (const row of report.spendByCategory) {
    lines.push(`${csvCell(row.category)},${paiseToRupees(row.spend).toFixed(2)}`);
  }
  lines.push("");
  lines.push("Top vendors by spend");
  lines.push("Vendor,Category,Orders,Spend (INR)");
  for (const row of report.topVendorsBySpend) {
    lines.push(
      [
        csvCell(row.vendor?.name ?? "—"),
        csvCell(row.vendor?.category ?? "—"),
        String(row.orders),
        paiseToRupees(row.spend).toFixed(2),
      ].join(",")
    );
  }
  return lines.join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function ReportsPage() {
  const { setPageTitle } = usePageTitle();
  const { data, error, isError, isLoading, refetch } = useReports();

  useEffect(() => {
    setPageTitle({
      description: "Procurement spend, top vendors, and monthly trends",
      title: "Reports",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  function handleExport() {
    if (!data) return;
    const csv = buildCsv(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `procurement-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to load reports</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{error?.message || "Unknown error"}</span>
          <Button onClick={() => refetch()} size="sm" variant="outline">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const totals = data?.totals;
  const spendByCategory = data?.spendByCategory ?? [];
  const topVendors = data?.topVendorsBySpend ?? [];
  const monthlyTrends = data?.monthlyTrends ?? [];
  const topVendorName = topVendors[0]?.vendor?.name ?? "—";
  const maxCategorySpend = Math.max(
    1,
    ...spendByCategory.map((c) => c.spend)
  );

  const chartData = monthlyTrends.map((m) => ({
    label: m.label,
    orders: m.orders,
    spend: paiseToRupees(m.spend),
  }));

  const isEmpty =
    !isLoading &&
    spendByCategory.length === 0 &&
    topVendors.length === 0 &&
    monthlyTrends.length === 0 &&
    (totals?.totalOrders ?? 0) === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button
          disabled={isLoading || !data}
          onClick={handleExport}
          size="sm"
          variant="outline"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={IndianRupee}
          label="Total spend"
          loading={isLoading}
          value={formatPaise(totals?.totalSpend)}
        />
        <KpiCard
          icon={ShoppingCart}
          label="Total orders"
          loading={isLoading}
          value={String(totals?.totalOrders ?? 0)}
        />
        <KpiCard
          icon={Boxes}
          label="Categories"
          loading={isLoading}
          value={String(spendByCategory.length)}
        />
        <KpiCard
          hint={topVendorName !== "—" ? "by spend" : undefined}
          icon={Crown}
          label="Top vendor"
          loading={isLoading}
          value={topVendorName}
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No procurement data yet
          </h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Spend analytics appear here once purchase orders are issued and
            fulfilled.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Spend by category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {spendByCategory.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No category spend recorded.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {spendByCategory.map((c) => (
                      <div key={c.category} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-foreground">
                            {c.category}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatPaise(c.spend)}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(
                                2,
                                (c.spend / maxCategorySpend) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Top vendors by spend
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                {topVendors.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No vendor spend recorded.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topVendors.map((v) => (
                        <TableRow key={v.vendorId}>
                          <TableCell className="font-medium text-foreground">
                            {v.vendor?.name ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {v.vendor?.category ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {v.orders}
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            {formatPaise(v.spend)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold">
                Monthly procurement trends
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pt-2">
              {chartData.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <p className="text-sm font-medium text-foreground">
                    No data yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Monthly spend appears once orders complete.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart
                    data={chartData}
                    margin={{ bottom: 5, left: 0, right: 8, top: 8 }}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [
                        `₹${Number(value ?? 0).toLocaleString("en-IN")}`,
                        "Spend",
                      ]}
                    />
                    <Bar
                      dataKey="spend"
                      fill="hsl(var(--chart-1))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
