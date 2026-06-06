"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type {
  CreateVendorInput,
  CreateVendorResponse,
  ListVendorsResponse,
  UpdateVendorInput,
  Vendor,
  VendorResponse,
  VendorStatus,
} from "@/lib/vb-types";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

export type VendorStatusFilter = "all" | VendorStatus;

const KEY_ROOT = ["vb", "vendors"] as const;
const KEY_LIST = (status: VendorStatusFilter, q: string) =>
  ["vb", "vendors", "list", status, q] as const;
const KEY_ONE = (id: string) => ["vb", "vendors", "detail", id] as const;

export function useVendors(
  status: VendorStatusFilter = "all",
  search = ""
) {
  return useQuery({
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString();
      const data = await apiFetch<ListVendorsResponse>(
        `/vb/vendors${qs ? `?${qs}` : ""}`
      );
      return data.items ?? [];
    },
    queryKey: KEY_LIST(status, search.trim()),
    staleTime: 30_000,
  });
}

export function useVendor(id: string) {
  const qc = useQueryClient();
  return useQuery({
    enabled: Boolean(id),
    initialData: () => {
      const lists = qc.getQueriesData<Vendor[]>({ queryKey: KEY_ROOT });
      for (const [, value] of lists) {
        const match = Array.isArray(value)
          ? value.find((v) => v._id === id)
          : undefined;
        if (match) return match;
      }
      return undefined;
    },
    queryFn: async () => {
      const res = await apiFetch<VendorResponse>(`/vb/vendors/${id}`);
      return res.vendor;
    },
    queryKey: KEY_ONE(id),
    staleTime: 15_000,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVendorInput) =>
      apiFetch<CreateVendorResponse>("/vb/vendors", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Failed to create vendor"),
    onSuccess: (res) => {
      toast.success(`Vendor "${res.vendor.name}" created`);
      qc.invalidateQueries({ queryKey: KEY_ROOT });
    },
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & UpdateVendorInput) =>
      apiFetch<VendorResponse>(`/vb/vendors/${id}`, {
        body: JSON.stringify(patch),
        method: "PATCH",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Failed to update vendor"),
    onSuccess: (_res, { id }) => {
      toast.success("Vendor updated");
      qc.invalidateQueries({ queryKey: KEY_ROOT });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
  });
}

export function useDeactivateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<VendorResponse>(`/vb/vendors/${id}/deactivate`, {
        method: "POST",
      }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY_ROOT });
      const snapshots = qc.getQueriesData<Vendor[]>({ queryKey: KEY_ROOT });
      for (const [key, value] of snapshots) {
        if (!Array.isArray(value)) continue;
        qc.setQueryData<Vendor[]>(
          key,
          value.map((v) =>
            v._id === id ? { ...v, status: "inactive" } : v
          )
        );
      }
      return { snapshots };
    },
    onError: (err: Error, _id, ctx) => {
      for (const [key, value] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, value);
      }
      toast.error(err.message || "Failed to deactivate vendor");
    },
    onSettled: (_d, _e, id) => {
      qc.invalidateQueries({ queryKey: KEY_ROOT });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
    onSuccess: () => toast.success("Vendor deactivated"),
  });
}

export function useActivateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<VendorResponse>(`/vb/vendors/${id}/activate`, { method: "POST" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY_ROOT });
      const snapshots = qc.getQueriesData<Vendor[]>({ queryKey: KEY_ROOT });
      for (const [key, value] of snapshots) {
        if (!Array.isArray(value)) continue;
        qc.setQueryData<Vendor[]>(
          key,
          value.map((v) => (v._id === id ? { ...v, status: "active" } : v))
        );
      }
      return { snapshots };
    },
    onError: (err: Error, _id, ctx) => {
      for (const [key, value] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, value);
      }
      toast.error(err.message || "Failed to activate vendor");
    },
    onSettled: (_d, _e, id) => {
      qc.invalidateQueries({ queryKey: KEY_ROOT });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
    onSuccess: () => toast.success("Vendor activated"),
  });
}

/** Reset a vendor's portal password and return fresh credentials to share. */
export function useResetVendorCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CreateVendorResponse>(`/vb/vendors/${id}/reset-credentials`, {
        method: "POST",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Failed to reset credentials"),
    onSuccess: () => {
      toast.success("Password reset — share the new credentials");
      qc.invalidateQueries({ queryKey: KEY_ROOT });
    },
  });
}
