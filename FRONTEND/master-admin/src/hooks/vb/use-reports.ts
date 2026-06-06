"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type { ReportsResponse } from "@/lib/vb-types";
import { useQuery } from "@tanstack/react-query";

export function useReports() {
  return useQuery({
    queryFn: () => apiFetch<ReportsResponse>("/vb/analytics/reports"),
    queryKey: ["vb", "analytics", "reports"],
    staleTime: 30_000,
  });
}
