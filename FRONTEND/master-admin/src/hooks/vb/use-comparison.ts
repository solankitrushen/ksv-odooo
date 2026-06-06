"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type { CompareResponse } from "@/lib/vb-types";
import { useQuery } from "@tanstack/react-query";

const KEY = (rfqId: string) => ["vb", "rfqs", "compare", rfqId] as const;

export function useComparison(rfqId: string) {
  return useQuery({
    enabled: Boolean(rfqId),
    queryFn: () => apiFetch<CompareResponse>(`/vb/rfq/${rfqId}/compare`),
    queryKey: KEY(rfqId),
    staleTime: 20_000,
  });
}
