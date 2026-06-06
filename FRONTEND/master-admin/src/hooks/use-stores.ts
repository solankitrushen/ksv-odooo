"use client";

import type {
  ListStoresResponse,
  Store,
  StoreRazorpayInput,
  StoreResponse,
} from "@/lib/api-types";
import { apiFetch } from "@/lib/backend-fetch";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

export type VerifiedFilter = "all" | "false" | "true";

export interface CreateStoreInput {
  address: {
    city: string;
    street: string;
    zipCode: string;
    building?: string;
    block?: string;
    shopNumber?: string;
    landmark?: string;
  };
  cuisineTypes?: string[];
  email: string;
  location: { latitude: number; longitude: number };
  name: string;
  owner?: { name: string; phone: string };
  password: string;
  phone: string;
  upiId?: string;
  commissionPercent?: number;
}

const KEY_LIST = (verified: VerifiedFilter) => ["stores", verified];
const KEY_ONE = (id: string) => ["stores", "detail", id];

export function useStores(verified: VerifiedFilter = "all") {
  return useQuery({
    queryFn: async () => {
      const query =
        verified === "all" ? "" : `?verified=${verified}`;
      const data = await apiFetch<ListStoresResponse>(
        `/admin/stores${query}`
      );
      return data.stores ?? [];
    },
    queryKey: KEY_LIST(verified),
    staleTime: 30_000,
  });
}

export function useStore(id: string) {
  const qc = useQueryClient();
  return useQuery({
    enabled: Boolean(id),
    initialData: () => {
      const lists = qc.getQueriesData<Store[]>({ queryKey: ["stores"] });
      for (const [, value] of lists) {
        const match = value?.find((s) => s._id === id);
        if (match) return match;
      }
      return undefined;
    },
    queryFn: async () => {
      const res = await apiFetch<StoreResponse>(`/admin/stores/${id}`);
      return res.store;
    },
    queryKey: KEY_ONE(id),
    staleTime: 15_000,
  });
}

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStoreInput) =>
      apiFetch<StoreResponse>("/admin/stores", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}

export function useVerifyStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<StoreResponse>(`/admin/stores/${id}/verify`, {
        method: "PATCH",
      }),
    onError: (err: Error) => toast.error(err.message || "Failed to verify"),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["stores"] });
      const snapshots = qc.getQueriesData<Store[]>({ queryKey: ["stores"] });
      for (const [key, value] of snapshots) {
        if (!Array.isArray(value)) continue;
        qc.setQueryData<Store[]>(
          key,
          value.map((s) => (s._id === id ? { ...s, isVerified: true } : s))
        );
      }
      const detail = qc.getQueryData<Store>(KEY_ONE(id));
      if (detail) {
        qc.setQueryData<Store>(KEY_ONE(id), { ...detail, isVerified: true });
      }
      return { snapshots, detail };
    },
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
    onSuccess: () => toast.success("Store verified"),
  });
}

export function useActivateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<StoreResponse>(`/admin/stores/${id}/activate`, {
        method: "PATCH",
      }),
    onError: (err: Error) => toast.error(err.message || "Failed to activate"),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["stores"] });
      const snapshots = qc.getQueriesData<Store[]>({ queryKey: ["stores"] });
      for (const [key, value] of snapshots) {
        if (!Array.isArray(value)) continue;
        qc.setQueryData<Store[]>(
          key,
          value.map((s) => (s._id === id ? { ...s, isActive: true } : s))
        );
      }
      const detail = qc.getQueryData<Store>(KEY_ONE(id));
      if (detail) {
        qc.setQueryData<Store>(KEY_ONE(id), { ...detail, isActive: true });
      }
      return { snapshots, detail };
    },
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
    onSuccess: () => toast.success("Store activated"),
  });
}

export function useUpdateStoreCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      email,
      password,
    }: {
      id: string;
      email?: string;
      password?: string;
    }) =>
      apiFetch<StoreResponse>(`/admin/stores/${id}/credentials`, {
        body: JSON.stringify({ email, password }),
        method: "PATCH",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Failed to update credentials"),
    onSuccess: (_data, { id }) => {
      toast.success("Credentials updated");
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
  });
}

export function useOnboardStoreRazorpay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<
        StoreResponse & { linkedAccountId: string; rawStatus: string }
      >(`/admin/stores/${id}/razorpay/onboard`, { method: "POST" }),
    onError: (err: Error) =>
      toast.error(err.message || "Razorpay onboarding failed"),
    onSuccess: (data, id) => {
      toast.success(`Linked account ${data.linkedAccountId} created`);
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
  });
}

export function useSyncStoreRazorpay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<StoreResponse & { rawStatus: string }>(
        `/admin/stores/${id}/razorpay/sync`,
        { method: "POST" }
      ),
    onError: (err: Error) => toast.error(err.message || "Sync failed"),
    onSuccess: (data, id) => {
      toast.success(`Onboarding status: ${data.rawStatus}`);
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
  });
}

export function useUpdateStoreRazorpay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & StoreRazorpayInput) =>
      apiFetch<StoreResponse>(`/admin/stores/${id}/razorpay`, {
        body: JSON.stringify(patch),
        method: "PATCH",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Failed to update Razorpay settings"),
    onSuccess: (_data, { id }) => {
      toast.success("Razorpay settings updated");
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
  });
}

export function useSendStoreEmailOTP() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message: string }>(`/admin/stores/${id}/send-email-otp`, {
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Failed to send OTP"),
    onSuccess: () => toast.success("OTP sent to store email"),
  });
}

export function useVerifyStoreEmailOTP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, otp }: { id: string; otp: string }) =>
      apiFetch<StoreResponse>(`/admin/stores/${id}/verify-email-otp`, {
        body: JSON.stringify({ otp }),
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Invalid OTP"),
    onSuccess: (_data, { id }) => {
      toast.success("Store email verified");
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
  });
}

export function useDeactivateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<StoreResponse>(`/admin/stores/${id}/deactivate`, {
        method: "PATCH",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Failed to deactivate"),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["stores"] });
      const snapshots = qc.getQueriesData<Store[]>({ queryKey: ["stores"] });
      for (const [key, value] of snapshots) {
        if (!Array.isArray(value)) continue;
        qc.setQueryData<Store[]>(
          key,
          value.map((s) => (s._id === id ? { ...s, isActive: false } : s))
        );
      }
      const detail = qc.getQueryData<Store>(KEY_ONE(id));
      if (detail) {
        qc.setQueryData<Store>(KEY_ONE(id), { ...detail, isActive: false });
      }
      return { snapshots, detail };
    },
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: KEY_ONE(id) });
    },
    onSuccess: () => toast.success("Store deactivated"),
  });
}
