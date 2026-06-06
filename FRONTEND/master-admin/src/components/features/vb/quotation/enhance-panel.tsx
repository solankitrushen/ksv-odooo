"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  useApplySuggestions,
  useEnhanceQuotation,
} from "@/hooks/vb/use-quotation-ai";
import type { AiEnhanceResponse, AiSuggestionSeverity } from "@/lib/vb-types";
import { Gauge, Lightbulb, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface Props {
  quotationId: string;
  /** Disable apply when the quotation can no longer be edited (e.g. submitted). */
  editable: boolean;
}

const SEVERITY_VARIANT: Record<
  AiSuggestionSeverity,
  "secondary" | "warning" | "destructive"
> = {
  info: "secondary",
  warn: "warning",
  high: "destructive",
};

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function EnhancePanel({ quotationId, editable }: Props) {
  const enhance = useEnhanceQuotation();
  const apply = useApplySuggestions();
  const [result, setResult] = useState<AiEnhanceResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const runEnhance = async () => {
    const res = await enhance.mutateAsync(quotationId);
    setResult(res);
    setSelected([]);
  };

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const applicable = (result?.suggestions ?? []).filter(
    (s) => s.proposed !== null && s.proposed !== undefined
  );

  const handleApply = async () => {
    if (selected.length === 0) return;
    await apply.mutateAsync({ quotationId, suggestionIds: selected });
    // re-score after applying
    await runEnhance();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Improve with AI
        </CardTitle>
        <CardDescription>
          Score your draft and get concrete, server-validated suggestions.
          Accepting one applies it as a normal edit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          disabled={enhance.isPending}
          onClick={runEnhance}
          variant={result ? "outline" : "default"}
        >
          <Gauge className="h-4 w-4" />
          {enhance.isPending
            ? "Scoring…"
            : result
              ? "Re-score"
              : "Score my draft"}
        </Button>

        {result && (
          <>
            <div className="rounded-lg border border-border p-4 dark:border-[#2a2a2a]">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  Build score
                </span>
                <span className={`text-2xl font-bold ${scoreColor(result.score)}`}>
                  {result.score}
                  <span className="text-sm font-normal text-muted-foreground">
                    /100
                  </span>
                </span>
              </div>
              <Progress className="mt-2" value={result.score} />
              {!result.peerStatsAvailable && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Peer pricing comparison needs at least 3 submitted competing
                  quotes — not enough yet, so price-vs-peer hints are skipped.
                </p>
              )}
            </div>

            {result.findings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Findings
                </p>
                <ul className="space-y-1">
                  {result.findings.map((f, i) => (
                    <li
                      className="flex items-start gap-2 text-sm text-foreground"
                      key={i}
                    >
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {applicable.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Suggestions ({applicable.length})
                </p>
                {applicable.map((s) => (
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/40 dark:border-[#2a2a2a]"
                    key={s.id}
                  >
                    <Checkbox
                      checked={selected.includes(s.id)}
                      disabled={!editable}
                      onCheckedChange={() => toggle(s.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={SEVERITY_VARIANT[s.severity]}>
                          {s.type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-foreground">
                        {s.rationale || "Proposed improvement"}
                      </p>
                    </div>
                  </label>
                ))}
                <Button
                  disabled={!editable || selected.length === 0 || apply.isPending}
                  onClick={handleApply}
                >
                  {apply.isPending
                    ? "Applying…"
                    : `Apply ${selected.length || ""} selected`.trim()}
                </Button>
                {!editable && (
                  <p className="text-xs text-muted-foreground">
                    This quotation can no longer be edited, so suggestions are
                    read-only.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No actionable suggestions — your draft looks good.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
