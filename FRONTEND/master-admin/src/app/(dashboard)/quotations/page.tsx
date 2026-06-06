"use client";

import { useAuth } from "@/contexts/auth-context";
import { VendorQuotations } from "@/components/features/vb/vendor-quotations";

export default function QuotationsPage() {
  const { isVendor } = useAuth();
  return isVendor ? <VendorQuotations /> : <StaffQuotationsPage />;
}


import { QuotationCompareMatrix } from "@/components/features/vb/quotation-compare-matrix";
import { RfqStatusBadge } from "@/components/features/vb/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/contexts/page-title-context";
import { useComparison } from "@/hooks/vb/use-comparison";
import { useRfqs } from "@/hooks/vb/use-rfqs";
import { cn } from "@/lib/utils";
import type { Rfq } from "@/lib/vb-types";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, FileSpreadsheet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function StaffQuotationsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton className="h-28 w-full" key={i} />
          ))}
        </div>
      }
    >
      <QuotationsHub />
    </Suspense>
  );
}

function QuotationsHub() {
  const { setPageTitle } = usePageTitle();
  const searchParams = useSearchParams();
  const preselect = searchParams.get("rfq");
  const [selectedId, setSelectedId] = useState<string | null>(preselect);

  const {
    data: rfqs,
    error: rfqsError,
    isError: rfqsIsError,
    isLoading: rfqsLoading,
    refetch: refetchRfqs,
  } = useRfqs("active");

  useEffect(() => {
    setPageTitle({
      description: "Compare vendor quotations side by side for an RFQ",
      title: "Quotation comparison",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  // Preselect via ?rfq= once, when it changes.
  useEffect(() => {
    if (preselect) setSelectedId(preselect);
  }, [preselect]);

  const selectedRfq = (rfqs ?? []).find((r) => r._id === selectedId) ?? null;

  if (selectedId) {
    return (
      <ComparisonView
        onBack={() => setSelectedId(null)}
        rfq={selectedRfq}
        rfqId={selectedId}
      />
    );
  }

  return (
    <div className="space-y-5">
      {rfqsIsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load RFQs</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{rfqsError?.message || "Unknown error"}</span>
            <Button onClick={() => refetchRfqs()} size="sm" variant="outline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {rfqsLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton className="h-28 w-full" key={i} />
          ))}
        </div>
      ) : !rfqsIsError && (rfqs ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No active RFQs to compare
          </h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Once an RFQ is active and vendors begin submitting quotations,
            select it here to compare prices line by line.
          </p>
        </div>
      ) : (
        !rfqsIsError && (
          <>
            <p className="text-sm text-muted-foreground">
              Select an active RFQ to compare its vendor quotations.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(rfqs ?? []).map((r) => (
                <RfqSelectCard
                  key={r._id}
                  onSelect={() => setSelectedId(r._id)}
                  rfq={r}
                />
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}

function RfqSelectCard({
  onSelect,
  rfq,
}: {
  onSelect: () => void;
  rfq: Rfq;
}) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50 hover:shadow-md"
      onClick={onSelect}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {rfq.reference}
          </span>
          <RfqStatusBadge status={rfq.status} />
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
          {rfq.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{rfq.category}</Badge>
          <span>{rfq.items.length} items</span>
          <span>· {rfq.assignedVendors.length} vendors</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Deadline {format(new Date(rfq.deadline), "MMM d, yyyy")}
        </p>
      </CardContent>
    </Card>
  );
}

function ComparisonView({
  onBack,
  rfq,
  rfqId,
}: {
  onBack: () => void;
  rfq: Rfq | null;
  rfqId: string;
}) {
  const { data, error, isError, isLoading, refetch } = useComparison(rfqId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} size="sm" variant="outline">
            <ArrowLeft className="h-4 w-4" />
            All RFQs
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {data?.rfq.reference ?? rfq?.reference ?? ""}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-foreground">
              {data?.rfq.title ?? rfq?.title ?? "Comparison"}
            </h2>
          </div>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load comparison</AlertTitle>
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
          <Skeleton className="h-24 w-full" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className={cn("h-12 w-full")} key={i} />
          ))}
        </div>
      ) : (
        !isError && data && <QuotationCompareMatrix data={data} />
      )}
    </div>
  );
}
