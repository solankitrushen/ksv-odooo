"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/contexts/page-title-context";
import { useActivity, type ActivityTypeFilter } from "@/hooks/vb/use-activity";
import { cn } from "@/lib/utils";
import type { ActivityLog, ActivityType } from "@/lib/vb-types";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Building2,
  CheckSquare,
  FileText,
  History,
  type LucideIcon,
  MessageSquare,
  Package,
  Receipt,
  ScrollText,
} from "lucide-react";
import { useEffect, useState } from "react";

const TABS: { label: string; value: ActivityTypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Approvals", value: "approval" },
  { label: "RFQs", value: "rfq" },
  { label: "Invoices", value: "invoice" },
  { label: "Quotations", value: "quotation" },
  { label: "Tickets", value: "ticket" },
];

const TYPE_ICON: Record<ActivityType, LucideIcon> = {
  approval: CheckSquare,
  invoice: Receipt,
  purchase_order: Package,
  quotation: FileText,
  rfq: ScrollText,
  ticket: MessageSquare,
  vendor: Building2,
};

const SEVERITY_DOT: Record<ActivityLog["severity"], string> = {
  error: "bg-destructive",
  info: "bg-muted-foreground",
  success: "bg-emerald-500",
  warn: "bg-amber-500",
};

const SEVERITY_BADGE: Record<ActivityLog["severity"], string> = {
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-border bg-muted text-muted-foreground",
  success:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<ActivityTypeFilter>("all");
  const { setPageTitle } = usePageTitle();
  const { data, error, isError, isLoading, refetch } = useActivity(filter);

  useEffect(() => {
    setPageTitle({
      description: "Audit trail across RFQs, quotations, approvals, and more",
      title: "Activity",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const items = data ?? [];

  return (
    <div className="space-y-5">
      <Tabs
        onValueChange={(v) => setFilter(v as ActivityTypeFilter)}
        value={filter}
      >
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load activity</AlertTitle>
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
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton className="h-16 w-full" key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <History className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No activity yet
          </h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Events from RFQs, quotations, approvals, invoices, and tickets will
            appear here as they happen.
          </p>
        </div>
      ) : (
        <ol className="relative ml-3 space-y-1 border-l border-border pl-6 dark:border-[#2a2a2a]">
          {items.map((event) => {
            const Icon = TYPE_ICON[event.type] ?? History;
            return (
              <li className="relative py-2" key={event._id}>
                <span
                  className={cn(
                    "absolute -left-[31px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                    SEVERITY_DOT[event.severity]
                  )}
                />
                <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 dark:border-[#2a2a2a] dark:bg-panel">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-[#262626]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{event.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        className={cn("font-normal", SEVERITY_BADGE[event.severity])}
                        variant="outline"
                      >
                        {event.type.replace(/_/g, " ")}
                      </Badge>
                      {event.actorRole && (
                        <span className="capitalize">{event.actorRole}</span>
                      )}
                      <span aria-hidden>·</span>
                      <span>{relativeTime(event.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
