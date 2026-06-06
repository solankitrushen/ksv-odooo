"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/hooks/use-stores";
import type { Store } from "@/lib/api-types";
import { formatDistanceToNow } from "date-fns";
import { Store as StoreIcon } from "lucide-react";
import Link from "next/link";

function timeAgo(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function RecentActivity() {
  const { data, isError, isLoading } = useStores("all");
  const stores = (data ?? [])
    .slice()
    .sort(
      (a: Store, b: Store) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Recent stores</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton className="h-12 w-full" key={i} />
            ))}
          </div>
        ) : isError ? (
          <p className="p-4 text-xs text-destructive">Failed to load.</p>
        ) : stores.length === 0 ? (
          <div className="flex flex-col items-center gap-1 p-6 text-center">
            <p className="text-sm font-medium text-foreground">
              No stores yet
            </p>
            <p className="text-xs text-muted-foreground">
              Provisioned stores will show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border dark:divide-[#2a2a2a]">
            {stores.map((s) => (
              <li key={s._id}>
                <Link
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30 dark:hover:bg-[#1c1c1c]"
                  href={`/stores/${s._id}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted dark:bg-[#262626]">
                      <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {s.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {timeAgo(s.createdAt)}
                      </p>
                    </div>
                  </div>
                  {s.isVerified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
