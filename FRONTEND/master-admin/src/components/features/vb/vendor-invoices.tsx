"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  useDownloadMyInvoice,
  useMyInvoices,
} from "@/hooks/vb/use-vendor-portal";
import { formatPaise } from "@/lib/money";
import { format } from "date-fns";
import { Download, Receipt } from "lucide-react";
import { useEffect } from "react";

export function VendorInvoices() {
  const { setPageTitle } = usePageTitle();
  const { data, isLoading } = useMyInvoices();
  const download = useDownloadMyInvoice();
  const rows = data ?? [];

  useEffect(() => {
    setPageTitle({ title: "Invoices", description: "Invoices issued to you" });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  if (isLoading) {
    return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton className="h-12 w-full" key={i} />)}</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Receipt className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No invoices yet</h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          Invoices are issued when your quotation is approved. They appear here to download.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>RFQ</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead className="text-right">PDF</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inv) => (
            <TableRow key={inv._id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{inv.number}</TableCell>
              <TableCell className="font-medium text-foreground">{inv.rfq?.reference ?? "—"}</TableCell>
              <TableCell className="font-medium">{formatPaise(inv.grandTotal, inv.currency)}</TableCell>
              <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {inv.issuedAt ? format(new Date(inv.issuedAt), "MMM d, yyyy") : "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  disabled={download.isPending}
                  onClick={() => download.mutate({ id: inv._id, filename: `${inv.number}.pdf` })}
                  size="sm"
                  variant="ghost"
                >
                  <Download className="h-4 w-4" /> Download
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
