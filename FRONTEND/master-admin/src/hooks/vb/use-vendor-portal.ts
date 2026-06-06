"use client";

import { API_URL } from "@/lib/backend-url";
import { apiFetch } from "@/lib/backend-fetch";
import type {
  Invoice,
  PurchaseOrder,
  Quotation,
  Ticket,
} from "@/lib/vb-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type WithRfq<T> = T & { rfq?: { _id: string; reference: string; title: string } | null };

async function blobDownload(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "X-Auth-Scope": "admin" },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const b = await res.json();
      message = b?.error || b?.message || message;
    } catch {
      /* non-json */
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

// --- Quotations -------------------------------------------------------------
export function useMyQuotations() {
  return useQuery({
    queryFn: async () => {
      const d = await apiFetch<{ items: WithRfq<Quotation>[] }>(
        "/vb/vendor/quotations"
      );
      return d.items ?? [];
    },
    queryKey: ["vb", "vendor", "quotations"],
    staleTime: 15_000,
  });
}

// --- Purchase orders --------------------------------------------------------
export function useMyPurchaseOrders() {
  return useQuery({
    queryFn: async () => {
      const d = await apiFetch<{ items: WithRfq<PurchaseOrder>[] }>(
        "/vb/vendor/purchase-orders"
      );
      return d.items ?? [];
    },
    queryKey: ["vb", "vendor", "purchase-orders"],
    staleTime: 20_000,
  });
}

export function useDownloadMyPo() {
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename?: string }) =>
      blobDownload(
        `/vb/vendor/purchase-orders/${id}/download`,
        filename || `po-${id}.pdf`
      ),
    onError: (err: Error) => toast.error(err.message || "Download failed"),
    onSuccess: () => toast.success("Purchase order downloaded"),
  });
}

// --- Invoices ---------------------------------------------------------------
export function useMyInvoices() {
  return useQuery({
    queryFn: async () => {
      const d = await apiFetch<{ items: WithRfq<Invoice>[] }>(
        "/vb/vendor/invoices"
      );
      return d.items ?? [];
    },
    queryKey: ["vb", "vendor", "invoices"],
    staleTime: 20_000,
  });
}

export function useDownloadMyInvoice() {
  return useMutation({
    mutationFn: ({ id, filename }: { id: string; filename?: string }) =>
      blobDownload(
        `/vb/vendor/invoices/${id}/download`,
        filename || `invoice-${id}.pdf`
      ),
    onError: (err: Error) => toast.error(err.message || "Download failed"),
    onSuccess: () => toast.success("Invoice downloaded"),
  });
}

// --- Tickets ----------------------------------------------------------------
export function useMyTickets() {
  return useQuery({
    queryFn: async () => {
      const d = await apiFetch<{ items: WithRfq<Ticket>[] }>("/vb/vendor/tickets");
      return d.items ?? [];
    },
    queryKey: ["vb", "vendor", "tickets"],
    staleTime: 15_000,
  });
}

export function useMyTicket(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: async () => {
      const d = await apiFetch<{ ticket: Ticket }>(`/vb/vendor/tickets/${id}`);
      return d.ticket;
    },
    queryKey: ["vb", "vendor", "tickets", id],
    staleTime: 10_000,
  });
}

export function useReplyMyTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch<{ ticket: Ticket }>(`/vb/vendor/tickets/${id}/reply`, {
        body: JSON.stringify({ body }),
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Reply failed"),
    onSuccess: (res) => {
      toast.success("Reply sent");
      qc.setQueryData(["vb", "vendor", "tickets", res.ticket._id], res.ticket);
      qc.invalidateQueries({ queryKey: ["vb", "vendor", "tickets"] });
    },
  });
}
