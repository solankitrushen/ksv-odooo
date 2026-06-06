"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalesReportRow } from "@/lib/api-types";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  series: SalesReportRow[];
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};

export function SalesChart({ series }: Props) {
  const data = series.map((row) => ({
    orders: row.orderCount,
    period: row.period,
    revenue: row.grossRevenue,
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-[280px] flex-col items-center justify-center gap-1">
          <p className="text-sm font-medium text-foreground">No data yet</p>
          <p className="text-xs text-muted-foreground">
            Try a wider date range or check back after orders complete.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold">Revenue</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px] pt-2">
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart
              data={data}
              margin={{ bottom: 5, left: 0, right: 8, top: 8 }}
            >
              <defs>
                <linearGradient id="repRevGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0}
                  />
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
                tickLine={false}
                width={40}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                dataKey="revenue"
                fill="url(#repRevGrad)"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold">Orders</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px] pt-2">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart
              data={data}
              margin={{ bottom: 5, left: 0, right: 8, top: 8 }}
            >
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
                tickLine={false}
                width={30}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="orders"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
