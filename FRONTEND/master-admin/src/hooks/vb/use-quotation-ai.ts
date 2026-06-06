"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type {
  AiAnswer,
  AiApplyInput,
  AiEnhanceResponse,
  AiGenerateResponse,
  AiSessionResponse,
  QuotationResponse,
} from "@/lib/vb-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const QUOTATION_KEY = (id: string) =>
  ["vb", "quotations", "detail", id] as const;

/** Start (or re-open) a generate session for an assigned RFQ. */
export function useStartAiSession() {
  return useMutation({
    mutationFn: (rfqId: string) =>
      apiFetch<AiSessionResponse>("/vb/quotations/ai/sessions", {
        body: JSON.stringify({ rfqId }),
        method: "POST",
      }),
    onError: (err: Error) =>
      toast.error(err.message || "Could not start AI session"),
  });
}

/** Submit answers to the structured Q&A (partial answering allowed). */
export function useAnswerAiSession() {
  return useMutation({
    mutationFn: ({
      sessionId,
      answers,
    }: {
      sessionId: string;
      answers: Pick<AiAnswer, "questionId" | "value">[];
    }) =>
      apiFetch<AiSessionResponse>(
        `/vb/quotations/ai/sessions/${sessionId}/answers`,
        { body: JSON.stringify({ answers }), method: "POST" }
      ),
    onError: (err: Error) =>
      toast.error(err.message || "Could not save answers"),
  });
}

/** Turn answers into an editable draft quotation (server recomputes totals). */
export function useGenerateAiDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<AiGenerateResponse>(
        `/vb/quotations/ai/sessions/${sessionId}/generate`,
        { method: "POST" }
      ),
    onError: (err: Error) =>
      toast.error(err.message || "AI draft generation failed"),
    onSuccess: (res) => {
      qc.setQueryData(QUOTATION_KEY(res.quotation._id), res.quotation);
      qc.invalidateQueries({ queryKey: ["vb", "rfqs"] });
      qc.invalidateQueries({ queryKey: ["vb", "vendor"] });
      toast.success("AI draft generated — review and edit before submitting");
    },
  });
}

/** Score + findings + suggestions for an existing draft (read-only). */
export function useEnhanceQuotation() {
  return useMutation({
    mutationFn: (quotationId: string) =>
      apiFetch<AiEnhanceResponse>(
        `/vb/quotations/${quotationId}/ai/enhance`,
        { method: "POST" }
      ),
    onError: (err: Error) => toast.error(err.message || "Enhance failed"),
  });
}

/** Accept one or more suggestions → applied via the core PATCH path. */
export function useApplySuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      quotationId,
      suggestionIds,
    }: { quotationId: string } & AiApplyInput) =>
      apiFetch<QuotationResponse>(
        `/vb/quotations/${quotationId}/ai/apply`,
        { body: JSON.stringify({ suggestionIds }), method: "POST" }
      ),
    onError: (err: Error) =>
      toast.error(err.message || "Could not apply suggestions"),
    onSuccess: (res, vars) => {
      qc.setQueryData(QUOTATION_KEY(res.quotation._id), res.quotation);
      toast.success(
        `Applied ${vars.suggestionIds.length} suggestion${
          vars.suggestionIds.length === 1 ? "" : "s"
        }`
      );
    },
  });
}
