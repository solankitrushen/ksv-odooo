"use client";

import { API_URL } from "@/lib/backend-url";
import { apiFetch } from "@/lib/backend-fetch";
import type {
  ApproveResponse,
  AutoReviewResponse,
  QuotationResponse,
  TicketResponse,
} from "@/lib/vb-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STAFF_QUOTES = (rfqId: string) =>
  ["vb", "quotations", "staff", rfqId] as const;

/** AI-score every submitted quotation on an RFQ. */
export function useAutoReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rfqId: string) =>
      apiFetch<AutoReviewResponse>(`/vb/rfq/${rfqId}/auto-review`, {
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Auto-review failed"),
    onSuccess: (res, rfqId) => {
      toast.success(`AI reviewed ${res.reviewed} quotation(s)`);
      qc.invalidateQueries({ queryKey: STAFF_QUOTES(rfqId) });
    },
  });
}

export function useApproveQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      rfqId,
      id,
      reason,
    }: {
      rfqId: string;
      id: string;
      reason?: string;
    }) =>
      apiFetch<ApproveResponse>(`/vb/rfq/${rfqId}/quotations/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onError: (err: Error) => toast.error(err.message || "Approve failed"),
    onSuccess: (res, { rfqId }) => {
      toast.success(`Approved — invoice ${res.invoice.number} generated`);
      qc.invalidateQueries({ queryKey: STAFF_QUOTES(rfqId) });
    },
  });
}

export function useRejectQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      rfqId,
      id,
      reason,
    }: {
      rfqId: string;
      id: string;
      reason?: string;
    }) =>
      apiFetch<QuotationResponse>(`/vb/rfq/${rfqId}/quotations/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onError: (err: Error) => toast.error(err.message || "Reject failed"),
    onSuccess: (_res, { rfqId }) => {
      toast.success("Quotation rejected");
      qc.invalidateQueries({ queryKey: STAFF_QUOTES(rfqId) });
    },
  });
}

/** Raise an AI-drafted bargaining ticket for a submitted quotation. */
export function useBargainQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rfqId, id }: { rfqId: string; id: string }) =>
      apiFetch<TicketResponse>(`/vb/rfq/${rfqId}/quotations/${id}/bargain`, {
        method: "POST",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Could not raise bargain ticket"),
    onSuccess: (res) => {
      toast.success(`Bargain ticket ${res.ticket.reference} sent to vendor`);
      qc.invalidateQueries({ queryKey: ["vb", "tickets"] });
    },
  });
}

/** Download the generated invoice PDF for an approved quotation. */
export function useDownloadInvoice() {
  return useMutation({
    mutationFn: async ({
      rfqId,
      id,
      filename,
    }: {
      rfqId: string;
      id: string;
      filename?: string;
    }) => {
      const res = await fetch(
        `${API_URL}/vb/rfq/${rfqId}/quotations/${id}/invoice`,
        { credentials: "include", headers: { "X-Auth-Scope": "admin" } }
      );
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
      a.download = filename || `invoice-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: (err: Error) => toast.error(err.message || "Download failed"),
    onSuccess: () => toast.success("Invoice downloaded"),
  });
}
