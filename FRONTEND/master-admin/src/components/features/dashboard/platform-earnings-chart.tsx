"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesReport } from "@/hooks/use-sales-report";
import { format } from "date-fns";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(n);
}

export function PlatformEarningsChart() {
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }, []);

  const { data, isError, isLoading } = useSalesReport({
    from: range.from,
    groupBy: "day",
    to: range.to,
  });

  const chartData = (data?.series ?? []).map((row) => ({
    fee: row.platformFee,
    gmv: row.grossRevenue,
    period: row.period,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">
          Platform GMV vs. my fee
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {format(range.from, "MMM d")} – {format(range.to, "MMM d")}
        </span>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : isError || chartData.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-foreground">
              No earnings yet
            </p>
            <p className="text-xs text-muted-foreground">
              Earnings will appear here as stores process orders.
            </p>
          </div>
        ) : (
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart
              data={chartData}
              margin={{ bottom: 5, left: 0, right: 8, top: 8 }}
            >
              <defs>
                <linearGradient id="gmvGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="feeGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="period"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                formatter={(value, name) => [
                  inr(Number(value ?? 0)),
                  name === "gmv" ? "GMV" : "My fee",
                ]}
              />
              <Legend
                formatter={(v) => (v === "gmv" ? "GMV" : "My fee")}
                iconType="circle"
                wrapperStyle={{ fontSize: 11 }}
              />
              <Area
                dataKey="gmv"
                fill="url(#gmvGrad)"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                type="monotone"
              />
              <Area
                dataKey="fee"
                fill="url(#feeGrad)"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
