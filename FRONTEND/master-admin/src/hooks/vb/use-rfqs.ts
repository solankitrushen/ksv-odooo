"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type {
  CreateRfqInput,
  ListRfqsResponse,
  Rfq,
  RfqResponse,
  RfqStatus,
  VendorRfqDetailResponse,
  VendorRfqInboxResponse,
} from "@/lib/vb-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type RfqStatusFilter = "all" | RfqStatus;

const KEY_ROOT = ["vb", "rfqs"] as const;
const KEY_LIST = (status: RfqStatusFilter) =>
  ["vb", "rfqs", "list", status] as const;
const KEY_ONE = (id: string) => ["vb", "rfqs", "detail", id] as const;
const KEY_INBOX = ["vb", "rfqs", "inbox"] as const;

// --- Staff (admin / officer / manager) -------------------------------------

export function useRfqs(status: RfqStatusFilter = "all") {
  return useQuery({
    queryFn: async () => {
      const qs = status === "all" ? "" : `?status=${status}`;
      const data = await apiFetch<ListRfqsResponse>(`/vb/rfq${qs}`);
      return data.items ?? [];
    },
    queryKey: KEY_LIST(status),
    staleTime: 30_000,
  });
}

export function useRfq(id: string) {
  const qc = useQueryClient();
  return useQuery({
    enabled: Boolean(id),
    initialData: () => {
      const lists = qc.getQueriesData<Rfq[]>({ queryKey: KEY_ROOT });
      for (const [, value] of lists) {
        const match = Array.isArray(value)
          ? value.find((r) => r._id === id)
          : undefined;
        if (match) return match;
      }
      return undefined;
    },
    queryFn: async () => {
      const res = await apiFetch<RfqResponse>(`/vb/rfq/${id}`);
      return res.rfq;
    },
    queryKey: KEY_ONE(id),
    staleTime: 15_000,
  });
}

export function useCreateRfq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRfqInput) =>
      apiFetch<RfqResponse>("/vb/rfq", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Failed to create RFQ"),
    onSuccess: (res) => {
      toast.success(
        `RFQ ${res.rfq.reference} created`,
        res.rfq.status === "active"
          ? { description: "Active and visible to assigned vendors." }
          : { description: "Saved as a draft." }
      );
      qc.invalidateQueries({ queryKey: KEY_ROOT });
    },
  });
}

// --- Vendor portal (vendor role) -------------------------------------------

export function useMyRfqInbox() {
  return useQuery({
    queryFn: async () => {
      const data = await apiFetch<VendorRfqInboxResponse>("/vb/vendor/rfqs");
      return data.items ?? [];
    },
    queryKey: KEY_INBOX,
    staleTime: 30_000,
  });
}

export function useMyRfq(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () =>
      apiFetch<VendorRfqDetailResponse>(`/vb/vendor/rfqs/${id}`),
    queryKey: ["vb", "rfqs", "mine", id],
    staleTime: 15_000,
  });
}
