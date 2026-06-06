"use client";

import { API_URL } from "@/lib/backend-url";
import { apiFetch } from "@/lib/backend-fetch";
import type {
  CreateQuotationInput,
  PatchQuotationInput,
  Quotation,
  QuotationResponse,
  StaffQuotationsResponse,
} from "@/lib/vb-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const KEY_ONE = (id: string) => ["vb", "quotations", "detail", id] as const;
const KEY_STAFF_LIST = (rfqId: string) =>
  ["vb", "quotations", "staff", rfqId] as const;

// --- Staff: quotations submitted for an RFQ --------------------------------

export function useStaffRfqQuotations(rfqId: string) {
  return useQuery({
    enabled: Boolean(rfqId),
    queryFn: async () => {
      const data = await apiFetch<StaffQuotationsResponse>(
        `/vb/rfq/${rfqId}/quotations`
      );
      return data.items ?? [];
    },
    queryKey: KEY_STAFF_LIST(rfqId),
    staleTime: 20_000,
  });
}

// --- Vendor: single quotation ----------------------------------------------

export function useQuotation(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiFetch<QuotationResponse>(`/vb/quotations/${id}`);
      return res.quotation;
    },
    queryKey: KEY_ONE(id),
    staleTime: 10_000,
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuotationInput) =>
      apiFetch<QuotationResponse>("/vb/quotations", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Failed to create quotation"),
    onSuccess: (res) => {
      qc.setQueryData(KEY_ONE(res.quotation._id), res.quotation);
      qc.invalidateQueries({ queryKey: ["vb", "rfqs"] });
      qc.invalidateQueries({ queryKey: ["vb", "vendor"] });
    },
  });
}

export function usePatchQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & PatchQuotationInput) =>
      apiFetch<QuotationResponse>(`/vb/quotations/${id}`, {
        body: JSON.stringify(patch),
        method: "PATCH",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Failed to save quotation"),
    onSuccess: (res) => {
      qc.setQueryData(KEY_ONE(res.quotation._id), res.quotation);
    },
  });
}

function useQuotationAction(
  action: "submit" | "withdraw" | "reaffirm" | "resubmit",
  successMsg: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch<QuotationResponse>(`/vb/quotations/${id}/${action}`, {
        method: "POST",
        body: reason ? JSON.stringify({ reason }) : undefined,
      }),
    onError: (err: Error) => toast.error(err.message || `Failed to ${action}`),
    onSuccess: (res) => {
      toast.success(successMsg);
      qc.setQueryData(KEY_ONE(res.quotation._id), res.quotation);
      qc.invalidateQueries({ queryKey: ["vb", "rfqs"] });
      qc.invalidateQueries({ queryKey: ["vb", "vendor"] });
    },
  });
}

export const useSubmitQuotation = () =>
  useQuotationAction("submit", "Quotation submitted");
export const useWithdrawQuotation = () =>
  useQuotationAction("withdraw", "Quotation withdrawn");
export const useReaffirmQuotation = () =>
  useQuotationAction("reaffirm", "Quotation reaffirmed");
export const useResubmitQuotation = () =>
  useQuotationAction("resubmit", "Revision draft created");

// --- PDF downloads (streamed; not JSON) ------------------------------------

async function downloadPdf(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "X-Auth-Scope": "admin" },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body?.error || body?.message || message;
    } catch {
      /* non-json error body */
    }
    throw new Error(message || "Download failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Vendor downloads their own quotation PDF (any status they own). */
export function useDownloadOwnQuotation() {
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename?: string }) =>
      downloadPdf(
        `/vb/quotations/${id}/download`,
        filename || `quotation-${id}.pdf`
      ),
    onError: (err: Error) => toast.error(err.message || "Download failed"),
    onSuccess: () => toast.success("Quotation PDF downloaded"),
  });
}

/** Staff downloads a submitted quotation PDF for an RFQ. */
export function useDownloadStaffQuotation() {
  return useMutation({
    mutationFn: ({
      rfqId,
      id,
      filename,
    }: {
      rfqId: string;
      id: string;
      filename?: string;
    }) =>
      downloadPdf(
        `/vb/rfq/${rfqId}/quotations/${id}/download`,
        filename || `quotation-${id}.pdf`
      ),
    onError: (err: Error) => toast.error(err.message || "Download failed"),
    onSuccess: () => toast.success("Quotation PDF downloaded"),
  });
}

export type { Quotation };
