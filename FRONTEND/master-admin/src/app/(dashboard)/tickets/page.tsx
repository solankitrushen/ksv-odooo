"use client";

import { useAuth } from "@/contexts/auth-context";
import { VendorTickets } from "@/components/features/vb/vendor-tickets";

export default function TicketsPage() {
  const { isVendor } = useAuth();
  return isVendor ? <VendorTickets /> : <StaffTicketsPage />;
}


import { TicketStatusBadge } from "@/components/features/vb/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTitle } from "@/contexts/page-title-context";
import {
  useCloseTicket,
  useReplyTicket,
  useTicket,
  useTickets,
  type TicketStatusFilter,
} from "@/hooks/vb/use-tickets";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/lib/vb-types";
import { format } from "date-fns";
import { AlertTriangle, MessageSquare, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

function StaffTicketsPage() {
  const [filter, setFilter] = useState<TicketStatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { setPageTitle } = usePageTitle();
  const { data, error, isError, isLoading, refetch } = useTickets(filter);

  useEffect(() => {
    setPageTitle({
      description: "Vendor negotiations, bargaining, and queries",
      title: "Tickets",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <Tabs onValueChange={(v) => setFilter(v as TicketStatusFilter)} value={filter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="awaiting_vendor">Awaiting vendor</TabsTrigger>
          <TabsTrigger value="awaiting_admin">Awaiting admin</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load tickets</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error?.message || "Unknown error"}</span>
            <Button onClick={() => refetch()} size="sm" variant="outline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton className="h-14 w-full" key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No tickets here
          </h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Bargaining and query tickets with vendors appear here. Raise a
            bargain from an RFQ&apos;s approvals panel.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow
                  className="cursor-pointer"
                  key={t._id}
                  onClick={() => setOpenId(t._id)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.reference}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate font-medium text-foreground">
                    {t.aiGenerated && (
                      <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />
                    )}
                    {t.subject}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.vendor?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(t.updatedAt), "MMM d, p")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TicketDialog
        id={openId}
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </div>
  );
}

function TicketDialog({
  id,
  onOpenChange,
}: {
  id: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: ticket, isLoading } = useTicket(id ?? "");
  const reply = useReplyTicket();
  const close = useCloseTicket();
  const [body, setBody] = useState("");

  const closed =
    ticket?.status === "closed" || ticket?.status === "resolved";

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(id)}>
      <DialogContent className="sm:max-w-2xl">
        {isLoading || !ticket ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {ticket.aiGenerated && (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                {ticket.subject}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <span className="font-mono">{ticket.reference}</span>·
                <span>{ticket.vendor?.name ?? "vendor"}</span>·
                <TicketStatusBadge status={ticket.status} />
              </DialogDescription>
            </DialogHeader>

            <TicketThread ticket={ticket} />

            {!closed ? (
              <div className="space-y-2">
                <Textarea
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Reply to the vendor…"
                  rows={3}
                  value={body}
                />
                <DialogFooter className="gap-2 sm:justify-between">
                  <Button
                    disabled={close.isPending}
                    onClick={async () => {
                      await close.mutateAsync({ id: ticket._id, resolved: true });
                    }}
                    variant="outline"
                  >
                    {close.isPending ? "Closing…" : "Mark resolved"}
                  </Button>
                  <Button
                    disabled={reply.isPending || body.trim().length === 0}
                    onClick={async () => {
                      await reply.mutateAsync({ id: ticket._id, body: body.trim() });
                      setBody("");
                    }}
                  >
                    {reply.isPending ? "Sending…" : "Send reply"}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This ticket is {ticket.status}.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TicketThread({ ticket }: { ticket: Ticket }) {
  return (
    <div className="max-h-[40vh] space-y-3 overflow-y-auto rounded-lg border border-border p-3 dark:border-[#2a2a2a]">
      {ticket.messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        ticket.messages.map((m, i) => {
          const mine = m.authorRole === "admin";
          return (
            <div
              className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              key={i}
            >
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                  mine
                    ? "bg-primary text-primary-foreground"
                    : m.authorRole === "ai"
                      ? "bg-muted text-foreground"
                      : "border border-border bg-card text-foreground dark:border-[#2a2a2a]"
                )}
              >
                {m.body}
              </div>
              <span className="mt-0.5 text-[10px] text-muted-foreground">
                {m.authorRole}
                {" · "}
                {format(new Date(m.createdAt), "MMM d, p")}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
