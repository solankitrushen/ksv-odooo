"use client";

import type { SalesReportResponse } from "@/lib/api-types";
import { apiFetch } from "@/lib/backend-fetch";
import { useQuery } from "@tanstack/react-query";

export interface SalesReportRange {
  from: Date;
  groupBy?: "day" | "month" | "week";
  to: Date;
}

export function useSalesReport(range: SalesReportRange) {
  const { from, groupBy = "day", to } = range;
  return useQuery({
    enabled: Boolean(from && to),
    queryFn: async () => {
      const qs = new URLSearchParams({
        from: from.toISOString(),
        groupBy,
        to: to.toISOString(),
      });
      const data = await apiFetch<SalesReportResponse>(
        `/admin/reports/sales?${qs.toString()}`
      );
      return data.report;
    },
    queryKey: ["sales-report", from.toISOString(), to.toISOString(), groupBy],
    staleTime: 30_000,
  });
}
