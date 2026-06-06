"use client";

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
import { usePerStore } from "@/hooks/use-per-store";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(n || 0);
}

export function PerStoreTable() {
  const router = useRouter();
  const { data, error, isError, isLoading, refetch } = usePerStore("30d");

  if (isLoading) return <Skeleton className="h-72 w-full" />;

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Could not load per-store analytics</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{error?.message || "Unknown error"}</span>
          <Button onClick={() => refetch()} size="sm" variant="outline">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const rows = data?.perStore ?? [];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center dark:border-[#2a2a2a]">
        <p className="text-sm font-medium text-foreground">No store sales in this period</p>
        <p className="text-xs text-muted-foreground">Per-store revenue, orders, and trending items appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border dark:border-[#2a2a2a]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Store</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">My fee</TableHead>
            <TableHead className="text-right">Avg basket</TableHead>
            <TableHead>Min / Delivery</TableHead>
            <TableHead>Trending</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              className="cursor-pointer"
              key={r.store.id}
              onClick={() => router.push(`/stores/${r.store.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{r.store.name}</span>
                  {r.store.isActive === false && <Badge variant="destructive">Inactive</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{r.store.commissionPercent ?? 15}% commission</span>
              </TableCell>
              <TableCell className="text-right text-foreground">{r.totalOrders}</TableCell>
              <TableCell className="text-right font-medium text-foreground">{inr(r.grossRevenue)}</TableCell>
              <TableCell className="text-right text-foreground">{inr(r.platformFee)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{inr(r.avgBasket)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.store.ordering
                  ? `min ${inr(r.store.ordering.minOrderValue)} · ${
                      r.store.ordering.deliveryFee === 0
                        ? "free"
                        : inr(r.store.ordering.deliveryFee)
                    }`
                  : "—"}
              </TableCell>
              <TableCell className="max-w-[200px]">
                <div className="flex flex-wrap gap-1">
                  {r.trendingItems.slice(0, 3).map((it) => (
                    <Badge key={it.menuItemId} variant="outline" className="font-normal">
                      {it.name} ×{it.qty}
                    </Badge>
                  ))}
                  {r.trendingItems.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
