"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type { AssistantResponse } from "@/lib/vb-types";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useAssistantChat() {
  return useMutation({
    mutationFn: (message: string) =>
      apiFetch<AssistantResponse>("/vb/assistant/chat", {
        body: JSON.stringify({ message }),
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Assistant unavailable"),
  });
}
