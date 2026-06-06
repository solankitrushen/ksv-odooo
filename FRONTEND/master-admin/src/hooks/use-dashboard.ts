"use client";

import type { DashboardResponse } from "@/lib/api-types";
import { apiFetch } from "@/lib/backend-fetch";
import { useQuery } from "@tanstack/react-query";

export function useDashboard(range: "30d" | "7d" = "7d") {
  return useQuery({
    queryFn: async () => {
      const days = range === "7d" ? 7 : 30;
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      const qs = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const data = await apiFetch<DashboardResponse>(
        `/admin/dashboard?${qs.toString()}`
      );
      return data.dashboard;
    },
    queryKey: ["dashboard", range],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
