"use client";

import { AiCopilot } from "@/components/features/vb/quotation/ai-copilot";
import { EnhancePanel } from "@/components/features/vb/quotation/enhance-panel";
import { QuotationDraftEditor } from "@/components/features/vb/quotation/quotation-draft-editor";
import { RfqPriorityBadge } from "@/components/features/vb/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/contexts/page-title-context";
import { useCreateQuotation, useQuotation } from "@/hooks/vb/use-quotations";
import { useMyRfq } from "@/hooks/vb/use-rfqs";
import type { Quotation } from "@/lib/vb-types";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function QuoteWorkspacePage() {
  const params = useParams<{ id: string }>();
  const rfqId = params.id;
  const qc = useQueryClient();
  const { setPageTitle } = usePageTitle();

  const { data: detail, error, isError, isLoading } = useMyRfq(rfqId);
  const createQuotation = useCreateQuotation();

  const [quotationId, setQuotationId] = useState<string | null>(null);

  // adopt an existing draft/submission once the RFQ detail loads
  useEffect(() => {
    if (detail?.myQuotation?._id) {
      qc.setQueryData(
        ["vb", "quotations", "detail", detail.myQuotation._id],
        detail.myQuotation
      );
      setQuotationId(detail.myQuotation._id);
    }
  }, [detail, qc]);

  const { data: quotation } = useQuotation(quotationId ?? "");

  useEffect(() => {
    setPageTitle({
      description: detail?.rfq ? detail.rfq.reference : "Build a quotation",
      title: detail?.rfq ? `Quote: ${detail.rfq.title}` : "Quotation",
    });
    return () => setPageTitle(null);
  }, [setPageTitle, detail]);

  const handleManualStart = async () => {
    const res = await createQuotation.mutateAsync({ rfqId });
    setQuotationId(res.quotation._id);
  };

  const onDraftGenerated = (q: Quotation) => setQuotationId(q._id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !detail?.rfq) {
    return (
      <div className="space-y-4">
        <Link href="/rfqs">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>RFQ unavailable</AlertTitle>
          <AlertDescription>
            {error?.message ||
              "This RFQ is not assigned to you, is closed, or no longer exists. The quotation workspace is available to vendor accounts."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const rfq = detail.rfq;
  const active = quotation ?? detail.myQuotation ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href={`/rfqs/${rfqId}`}>
          <Button size="sm" variant="ghost">
            <ArrowLeft className="h-4 w-4" />
            Back to RFQ
          </Button>
        </Link>
        <RfqPriorityBadge priority={rfq.priority} />
      </div>

      {/* RFQ summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {rfq.reference}
            </span>
            {rfq.title}
          </CardTitle>
          <CardDescription>
            {rfq.items.length} item(s) · category {rfq.category} · deadline{" "}
            {format(new Date(rfq.deadline), "MMM d, yyyy p")}
          </CardDescription>
        </CardHeader>
      </Card>

      {!active ? (
        // --- choose how to start ---------------------------------------
        <div className="grid gap-4 lg:grid-cols-2">
          <AiCopilot onDraftGenerated={onDraftGenerated} rfqId={rfqId} />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilePlus2 className="h-5 w-5 text-muted-foreground" />
                Build manually
              </CardTitle>
              <CardDescription>
                Start from a blank draft and price each item yourself. You can
                run the AI &quot;Improve&quot; scorer at any time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                disabled={createQuotation.isPending}
                onClick={handleManualStart}
                variant="outline"
              >
                {createQuotation.isPending
                  ? "Creating draft…"
                  : "Create blank draft"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        // --- editor + enhance ------------------------------------------
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <QuotationDraftEditor
            onReplace={(q) => setQuotationId(q._id)}
            quotation={active}
          />
          <div className="space-y-5">
            <EnhancePanel
              editable={active.status === "draft"}
              quotationId={active._id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
