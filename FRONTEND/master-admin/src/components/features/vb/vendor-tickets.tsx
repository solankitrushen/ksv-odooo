"use client";

import { TicketStatusBadge } from "@/components/features/vb/status-badges";
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
  useMyTicket,
  useMyTickets,
  useReplyMyTicket,
} from "@/hooks/vb/use-vendor-portal";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { MessageSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function VendorTickets() {
  const { setPageTitle } = usePageTitle();
  const { data, isLoading } = useMyTickets();
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = data ?? [];

  useEffect(() => {
    setPageTitle({ title: "Tickets", description: "Negotiations and messages from the buyer" });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton className="h-12 w-full" key={i} />)}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No tickets</h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            If the buyer requests a price revision, the negotiation appears here for you to respond.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>RFQ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow className="cursor-pointer" key={t._id} onClick={() => setOpenId(t._id)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.reference}</TableCell>
                  <TableCell className="max-w-[220px] truncate font-medium text-foreground">
                    {t.aiGenerated && <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />}
                    {t.subject}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.rfq?.reference ?? "—"}</TableCell>
                  <TableCell><TicketStatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(t.updatedAt), "MMM d, p")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TicketDialog id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}

function TicketDialog({ id, onOpenChange }: { id: string | null; onOpenChange: (o: boolean) => void }) {
  const { data: ticket, isLoading } = useMyTicket(id ?? "");
  const reply = useReplyMyTicket();
  const [body, setBody] = useState("");
  const closed = ticket?.status === "closed" || ticket?.status === "resolved";

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(id)}>
      <DialogContent className="sm:max-w-2xl">
        {isLoading || !ticket ? (
          <div className="space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-40 w-full" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {ticket.aiGenerated && <Sparkles className="h-4 w-4 text-primary" />}
                {ticket.subject}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <span className="font-mono">{ticket.reference}</span>
                <Badge variant="outline">{ticket.type}</Badge>
                <TicketStatusBadge status={ticket.status} />
              </DialogDescription>
            </DialogHeader>

            {ticket.rfqId && (
              <Link href={`/rfqs/${ticket.rfqId}/quote`}>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Revise your quotation with AI, then resubmit for approval
                  </span>
                  <Button size="sm">Open quote</Button>
                </div>
              </Link>
            )}

            <div className="max-h-[40vh] space-y-3 overflow-y-auto rounded-lg border border-border p-3 dark:border-[#2a2a2a]">
              {ticket.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                ticket.messages.map((m, i) => {
                  const mine = m.authorRole === "vendor";
                  return (
                    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")} key={i}>
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
                        {m.authorRole} · {format(new Date(m.createdAt), "MMM d, p")}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {!closed ? (
              <div className="space-y-2">
                <Textarea
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Reply to the buyer…"
                  rows={3}
                  value={body}
                />
                <DialogFooter>
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
              <p className="text-sm text-muted-foreground">This ticket is {ticket.status}.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
