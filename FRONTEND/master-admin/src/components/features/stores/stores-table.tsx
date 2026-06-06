"use client";

import { StoreActions } from "@/components/features/stores/store-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Store } from "@/lib/api-types";
import { format } from "date-fns";
import { ExternalLink, Store as StoreIcon } from "lucide-react";
import Link from "next/link";

interface Props {
  stores: Store[];
}

function safeFormat(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

export function StoresTable({ stores }: Props) {
  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <StoreIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          No stores match this filter
        </h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          Try clearing the search or switching to All. New stores you
          provision will appear here instantly.
        </p>
        <Link href="/stores/new">
          <Button size="sm">Provision a store</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Verified</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Manage</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stores.map((store) => (
            <TableRow key={store._id}>
              <TableCell className="font-medium text-foreground">
                {store.name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {store.email}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {store.phone}
              </TableCell>
              <TableCell>
                {store.isVerified ? (
                  <Badge variant="success">Verified</Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </TableCell>
              <TableCell>
                {store.isActive ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {safeFormat(store.createdAt)}
              </TableCell>
              <TableCell>
                <StoreActions store={store} variant="compact" />
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/stores/${store._id}`}>
                  <Button size="sm" variant="ghost">
                    <ExternalLink className="h-4 w-4" />
                    View
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
