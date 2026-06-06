"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/hooks/use-stores";

export function TopStoresCard() {
  const { data, isError, isLoading } = useStores("all");
  const stores = data ?? [];
  const total = stores.length;
  const active = stores.filter((s) => s.isActive).length;
  const verified = stores.filter((s) => s.isVerified).length;
  const inactive = total - active;
  const pending = total - verified;
  const activePct = total === 0 ? 0 : Math.round((active / total) * 100);
  const verifiedPct = total === 0 ? 0 : Math.round((verified / total) * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Store health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <p className="text-xs text-destructive">Failed to load.</p>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <p className="text-sm font-medium text-foreground">No stores yet</p>
            <p className="text-xs text-muted-foreground">
              Create a store to start tracking earnings.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Active</span>
                <span className="text-muted-foreground">
                  {active} / {total} · {activePct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-[#262626]">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${activePct}%` }}
                />
              </div>
              {inactive > 0 && (
                <p className="text-xs text-muted-foreground">
                  {inactive} deactivated
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Verified</span>
                <span className="text-muted-foreground">
                  {verified} / {total} · {verifiedPct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-[#262626]">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${verifiedPct}%` }}
                />
              </div>
              {pending > 0 && (
                <Badge variant="warning">{pending} pending verification</Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
