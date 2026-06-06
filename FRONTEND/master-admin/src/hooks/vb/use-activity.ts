"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type { ActivityType, ListActivityResponse } from "@/lib/vb-types";
import { useQuery } from "@tanstack/react-query";

export type ActivityTypeFilter = "all" | ActivityType;

const KEY_LIST = (type: ActivityTypeFilter) =>
  ["vb", "activity", "list", type] as const;

export function useActivity(type: ActivityTypeFilter = "all") {
  return useQuery({
    queryFn: async () => {
      const qs = type === "all" ? "" : `?type=${type}`;
      const data = await apiFetch<ListActivityResponse>(`/vb/activity${qs}`);
      return data.items ?? [];
    },
    queryKey: KEY_LIST(type),
    staleTime: 15_000,
  });
}
