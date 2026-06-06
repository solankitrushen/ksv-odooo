"use client";

import type { PerStoreResponse } from "@/lib/api-types";
import { apiFetch } from "@/lib/backend-fetch";
import { useQuery } from "@tanstack/react-query";

export function usePerStore(range: "30d" | "7d" = "30d") {
  return useQuery({
    queryFn: async () => {
      const days = range === "7d" ? 7 : 30;
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      const qs = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      return apiFetch<PerStoreResponse>(
        `/admin/dashboard/per-store?${qs.toString()}`,
      );
    },
    queryKey: ["per-store", range],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
