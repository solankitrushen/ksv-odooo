"use client";

import { RfqApprovalsPanel } from "@/components/features/vb/rfq-approvals-panel";
import { RfqStatusBadge } from "@/components/features/vb/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/contexts/page-title-context";
import { useRfqs } from "@/hooks/vb/use-rfqs";
import { useVendors } from "@/hooks/vb/use-vendors";
import { AlertTriangle, ClipboardCheck } from "lucide-react";
import { useEffect } from "react";

export default function ApprovalsPage() {
  const { setPageTitle } = usePageTitle();
  const {
    data: rfqs,
    error,
    isError,
    isLoading,
    refetch,
  } = useRfqs("active");
  const { data: vendors } = useVendors("all");

  useEffect(() => {
    setPageTitle({
      description: "Review and decide on vendor quotations across active RFQs",
      title: "Approvals",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const activeRfqs = rfqs ?? [];
  const vendorList = vendors ?? [];

  return (
    <div className="space-y-5">
      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load approvals</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error?.message || "Unknown error"}</span>
            <Button onClick={() => refetch()} size="sm" variant="outline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div className="space-y-2" key={i}>
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-40 w-full" />
            </div>
          ))}
        </div>
      ) : !isError && activeRfqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No active RFQs awaiting approval
          </h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            When an RFQ is active and vendors submit quotations, run AI
            auto-review and approve, reject, or bargain right here.
          </p>
        </div>
      ) : (
        !isError &&
        activeRfqs.map((rfq) => (
          <section className="space-y-2" key={rfq._id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {rfq.reference}
              </span>
              <h2 className="text-sm font-semibold text-foreground">
                {rfq.title}
              </h2>
              <RfqStatusBadge status={rfq.status} />
              <Badge variant="outline">{rfq.category}</Badge>
            </div>
            <RfqApprovalsPanel
              rfqId={rfq._id}
              rfqReference={rfq.reference}
              vendors={vendorList}
            />
          </section>
        ))
      )}
    </div>
  );
}
