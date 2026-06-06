"use client";

import { useAuth } from "@/contexts/auth-context";
import { VendorInvoices } from "@/components/features/vb/vendor-invoices";

export default function InvoicesPage() {
  const { isVendor } = useAuth();
  return isVendor ? <VendorInvoices /> : <StaffInvoicesPage />;
}


import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useDownloadInvoiceById,
  useEmailInvoice,
  useInvoices,
} from "@/hooks/vb/use-invoices";
import {
  useDownloadPurchaseOrder,
  usePurchaseOrders,
} from "@/hooks/vb/use-purchase-orders";
import { API_URL } from "@/lib/backend-url";
import { formatPaise } from "@/lib/money";
import type { Invoice, InvoiceStatus, PurchaseOrder } from "@/lib/vb-types";
import { format } from "date-fns";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MoreHorizontal,
  Printer,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// The list endpoint decorates each invoice with vendor/rfq lookups that are
// not part of the base Invoice schema type.
type EnrichedInvoice = Invoice & {
  vendor?: { _id?: string; name: string; category?: string } | null;
  rfq?: { _id?: string; reference: string; title?: string } | null;
};

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

const INVOICE_STATUS_MAP: Record<
  InvoiceStatus,
  { variant: BadgeVariant; label: string }
> = {
  issued: { variant: "default", label: "Issued" },
  paid: { variant: "success", label: "Paid" },
  cancelled: { variant: "destructive", label: "Cancelled" },
};

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

/** Fetch the invoice PDF and trigger the browser print dialog via iframe. */
async function printInvoice(id: string) {
  let url: string | null = null;
  let iframe: HTMLIFrameElement | null = null;
  try {
    const res = await fetch(`${API_URL}/vb/invoices/${id}/download`, {
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
      throw new Error(message || "Print failed");
    }
    const blob = await res.blob();
    url = URL.createObjectURL(blob);

    iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    const frameUrl = url;
    const frameEl = iframe;
    iframe.onload = () => {
      try {
        frameEl.contentWindow?.focus();
        frameEl.contentWindow?.print();
      } catch {
        toast.error("Unable to open the print dialog");
      }
    };
    iframe.src = frameUrl;
    document.body.appendChild(iframe);

    // Defer cleanup so the print dialog has time to read the blob.
    window.setTimeout(() => {
      if (frameEl.parentNode) frameEl.parentNode.removeChild(frameEl);
      URL.revokeObjectURL(frameUrl);
    }, 60_000);
  } catch (err) {
    if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
    if (url) URL.revokeObjectURL(url);
    toast.error(err instanceof Error ? err.message : "Print failed");
  }
}

function StaffInvoicesPage() {
  const { setPageTitle } = usePageTitle();
  const { data, error, isError, isLoading, refetch } = useInvoices();
  const download = useDownloadInvoiceById();
  const email = useEmailInvoice();
  const { data: purchaseOrders } = usePurchaseOrders();
  const downloadPo = useDownloadPurchaseOrder();
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle({
      description: "Issued invoices — download, email, or print",
      title: "Invoices",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const invoices = useMemo(
    () => (data ?? []) as EnrichedInvoice[],
    [data]
  );

  // Link each invoice to its purchase order (if one was generated) so staff can
  // grab the PO PDF from the same row.
  const poByInvoiceId = useMemo(() => {
    const m = new Map<string, PurchaseOrder>();
    for (const po of purchaseOrders ?? []) {
      if (po.invoiceId) m.set(po.invoiceId, po);
    }
    return m;
  }, [purchaseOrders]);

  async function handlePrint(id: string) {
    setPrintingId(id);
    try {
      await printInvoice(id);
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load invoices</AlertTitle>
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
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-14 w-full" key={i} />
          ))}
        </div>
      ) : isError ? null : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No invoices yet
          </h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Invoices are generated when a quotation is approved. They appear
            here ready to download, email, or print.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>RFQ</TableHead>
                <TableHead className="text-right">Grand total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const m = INVOICE_STATUS_MAP[inv.status] ?? {
                  variant: "outline" as const,
                  label: inv.status,
                };
                const linkedPo = poByInvoiceId.get(inv._id);
                const busy =
                  printingId === inv._id ||
                  (download.isPending &&
                    download.variables?.id === inv._id) ||
                  (email.isPending && email.variables === inv._id) ||
                  (downloadPo.isPending &&
                    downloadPo.variables?.id === linkedPo?._id);
                return (
                  <TableRow key={inv._id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {inv.number}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {inv.vendor?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.rfq?.reference ? (
                        <Link
                          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                          href={`/rfqs/${inv.rfqId}`}
                        >
                          {inv.rfq.reference}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {formatPaise(inv.grandTotal, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.variant}>{m.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(inv.issuedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            disabled={busy}
                            size="sm"
                            variant="ghost"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              download.mutate({
                                id: inv._id,
                                filename: `${inv.number}.pdf`,
                              })
                            }
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={inv.status === "cancelled"}
                            onSelect={() => email.mutate(inv._id)}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Email vendor
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handlePrint(inv._id)}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </DropdownMenuItem>
                          {linkedPo && (
                            <DropdownMenuItem
                              onSelect={() =>
                                downloadPo.mutate({
                                  id: linkedPo._id,
                                  filename: `${linkedPo.number}.pdf`,
                                })
                              }
                            >
                              <ScrollText className="mr-2 h-4 w-4" />
                              Download PO ({linkedPo.number})
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
