"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type { VbAnalyticsDashboard } from "@/lib/vb-types";
import { useQuery } from "@tanstack/react-query";

export function useVbDashboard() {
  return useQuery({
    queryFn: () =>
      apiFetch<VbAnalyticsDashboard>("/vb/analytics/dashboard"),
    queryKey: ["vb", "analytics", "dashboard"],
    staleTime: 30_000,
  });
}
