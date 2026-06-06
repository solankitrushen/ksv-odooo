"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type {
  CreateTicketInput,
  ListTicketsResponse,
  Ticket,
  TicketResponse,
  TicketStatus,
} from "@/lib/vb-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type TicketStatusFilter = "all" | TicketStatus;

const KEY_ROOT = ["vb", "tickets"] as const;
const KEY_LIST = (status: TicketStatusFilter) =>
  ["vb", "tickets", "list", status] as const;
const KEY_ONE = (id: string) => ["vb", "tickets", "detail", id] as const;

export function useTickets(status: TicketStatusFilter = "all") {
  return useQuery({
    queryFn: async () => {
      const qs = status === "all" ? "" : `?status=${status}`;
      const data = await apiFetch<ListTicketsResponse>(`/vb/tickets${qs}`);
      return data.items ?? [];
    },
    queryKey: KEY_LIST(status),
    staleTime: 20_000,
  });
}

export function useTicket(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiFetch<TicketResponse>(`/vb/tickets/${id}`);
      return res.ticket;
    },
    queryKey: KEY_ONE(id),
    staleTime: 10_000,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) =>
      apiFetch<TicketResponse>("/vb/tickets", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Failed to create ticket"),
    onSuccess: (res) => {
      toast.success(`Ticket ${res.ticket.reference} created`);
      qc.invalidateQueries({ queryKey: KEY_ROOT });
    },
  });
}

export function useReplyTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch<TicketResponse>(`/vb/tickets/${id}/reply`, {
        body: JSON.stringify({ body }),
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Reply failed"),
    onSuccess: (res) => {
      toast.success("Reply sent");
      qc.setQueryData<Ticket>(KEY_ONE(res.ticket._id), res.ticket);
      qc.invalidateQueries({ queryKey: KEY_ROOT });
    },
  });
}

export function useCloseTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolved = true }: { id: string; resolved?: boolean }) =>
      apiFetch<TicketResponse>(`/vb/tickets/${id}/close`, {
        body: JSON.stringify({ resolved }),
        method: "POST",
      }),
    onError: (err: Error) => toast.error(err.message || "Close failed"),
    onSuccess: (res) => {
      toast.success("Ticket closed");
      qc.setQueryData<Ticket>(KEY_ONE(res.ticket._id), res.ticket);
      qc.invalidateQueries({ queryKey: KEY_ROOT });
    },
  });
}
