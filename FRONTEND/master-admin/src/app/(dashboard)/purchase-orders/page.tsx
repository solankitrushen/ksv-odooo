"use client";

import { useAuth } from "@/contexts/auth-context";
import { VendorPurchaseOrders } from "@/components/features/vb/vendor-purchase-orders";

export default function PurchaseOrdersPage() {
  const { isVendor } = useAuth();
  return isVendor ? <VendorPurchaseOrders /> : <StaffPurchaseOrdersPage />;
}


import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/contexts/page-title-context";
import {
  useDownloadPurchaseOrder,
  usePurchaseOrders,
} from "@/hooks/vb/use-purchase-orders";
import { formatPaise } from "@/lib/money";
import type { PurchaseOrderStatus } from "@/lib/vb-types";
import { format } from "date-fns";
import { AlertTriangle, Download, ExternalLink, Package } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StatusFilter = "all" | PurchaseOrderStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "issued", label: "Issued" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
];

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

const PO_STATUS_MAP: Record<
  PurchaseOrderStatus,
  { variant: BadgeVariant; label: string }
> = {
  issued: { variant: "default", label: "Issued" },
  acknowledged: { variant: "warning", label: "Acknowledged" },
  fulfilled: { variant: "success", label: "Fulfilled" },
  cancelled: { variant: "destructive", label: "Cancelled" },
};

function fmtDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

function StaffPurchaseOrdersPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const { setPageTitle } = usePageTitle();
  const { data, error, isError, isLoading, refetch } = usePurchaseOrders();
  const download = useDownloadPurchaseOrder();

  useEffect(() => {
    setPageTitle({
      description: "Issued purchase orders and their fulfilment status",
      title: "Purchase orders",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (filter === "all") return items;
    return items.filter((po) => po.status === filter);
  }, [data, filter]);

  return (
    <div className="space-y-5">
      <Tabs
        onValueChange={(v) => setFilter(v as StatusFilter)}
        value={filter}
      >
        <TabsList>
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load purchase orders</AlertTitle>
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
      ) : isError ? null : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No purchase orders
          </h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Purchase orders appear here once a quotation is approved and an
            order is issued to a vendor.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>RFQ</TableHead>
                <TableHead className="text-right">Grand total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((po) => {
                const m = PO_STATUS_MAP[po.status] ?? {
                  variant: "outline" as const,
                  label: po.status,
                };
                return (
                  <TableRow key={po._id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {po.number}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {po.vendor?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {po.rfq?.reference ? (
                        <Link
                          className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                          href={`/rfqs/${po.rfqId}`}
                        >
                          {po.rfq.reference}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {formatPaise(po.grandTotal, po.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.variant}>{m.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(po.issuedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        disabled={download.isPending}
                        onClick={() =>
                          download.mutate({
                            id: po._id,
                            filename: `${po.number}.pdf`,
                          })
                        }
                        size="sm"
                        variant="ghost"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
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
