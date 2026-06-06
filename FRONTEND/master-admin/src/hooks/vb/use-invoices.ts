"use client";

import { API_URL } from "@/lib/backend-url";
import { apiFetch } from "@/lib/backend-fetch";
import type {
  EmailInvoiceResponse,
  ListInvoicesResponse,
} from "@/lib/vb-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const KEY_LIST = ["vb", "invoices", "list"] as const;

export function useInvoices() {
  return useQuery({
    queryFn: async () => {
      const data = await apiFetch<ListInvoicesResponse>("/vb/invoices");
      return data.items ?? [];
    },
    queryKey: KEY_LIST,
    staleTime: 20_000,
  });
}

// --- PDF download (streamed; not JSON) -------------------------------------

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

export function useDownloadInvoiceById() {
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename?: string }) =>
      downloadPdf(
        `/vb/invoices/${id}/download`,
        filename || `invoice-${id}.pdf`
      ),
    onError: (err: Error) => toast.error(err.message || "Download failed"),
    onSuccess: () => toast.success("Invoice downloaded"),
  });
}

export function useEmailInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<EmailInvoiceResponse>(`/vb/invoices/${id}/email`, {
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Failed to email invoice"),
    onSuccess: (res) => {
      toast.success(res.message || "Invoice emailed");
      qc.invalidateQueries({ queryKey: KEY_LIST });
    },
  });
}
