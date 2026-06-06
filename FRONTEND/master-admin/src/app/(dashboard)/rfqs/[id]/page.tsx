"use client";

import { RfqApprovalsPanel } from "@/components/features/vb/rfq-approvals-panel";
import {
  RfqPriorityBadge,
  RfqStatusBadge,
} from "@/components/features/vb/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useRfq } from "@/hooks/vb/use-rfqs";
import { useVendors } from "@/hooks/vb/use-vendors";
import type { Vendor } from "@/lib/vb-types";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function RfqDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { setPageTitle } = usePageTitle();

  const { data: rfq, error, isError, isLoading } = useRfq(id);
  const { data: vendors } = useVendors("all");

  useEffect(() => {
    setPageTitle({
      description: rfq ? rfq.reference : "RFQ detail",
      title: rfq ? rfq.title : "RFQ",
    });
    return () => setPageTitle(null);
  }, [setPageTitle, rfq]);

  const vendorById = useMemo(() => {
    const m = new Map<string, Vendor>();
    for (const v of vendors ?? []) m.set(v._id, v);
    return m;
  }, [vendors]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !rfq) {
    return (
      <div className="space-y-4">
        <Link href="/rfqs">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-4 w-4" />
            Back to RFQs
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>RFQ not found</AlertTitle>
          <AlertDescription>
            {error?.message || "This RFQ may have been removed."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/rfqs">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-4 w-4" />
            Back to RFQs
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <RfqStatusBadge status={rfq.status} />
          <RfqPriorityBadge priority={rfq.priority} />
        </div>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {rfq.reference}
            </span>
            {rfq.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" value={rfq.category} />
          <Field
            label="Deadline"
            value={format(new Date(rfq.deadline), "MMM d, yyyy p")}
          />
          <Field
            label="Created"
            value={format(new Date(rfq.createdAt), "MMM d, yyyy")}
          />
          {rfq.description ? (
            <div className="sm:col-span-3">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-sm text-foreground">{rfq.description}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line items ({rfq.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rfq.items.map((it, i) => (
                <TableRow key={`${it.name}-${i}`}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    {it.name}
                  </TableCell>
                  <TableCell>{it.qty}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {it.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assigned vendors */}
      <Card>
        <CardHeader>
          <CardTitle>
            Assigned vendors ({rfq.assignedVendors.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rfq.assignedVendors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vendors assigned. Edit this RFQ to invite vendors.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rfq.assignedVendors.map((vid) => {
                const v = vendorById.get(vid);
                return (
                  <Badge key={vid} variant="outline">
                    {v ? `${v.name} · ${v.category}` : vid}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quotations & approvals */}
      <RfqApprovalsPanel
        rfqId={rfq._id}
        rfqReference={rfq.reference}
        vendors={vendors ?? []}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
