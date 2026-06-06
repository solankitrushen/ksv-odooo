"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivity } from "@/hooks/vb/use-activity";
import { cn } from "@/lib/utils";
import type { ActivityLog } from "@/lib/vb-types";

const MAX_ITEMS = 8;
// Items newer than this window count as "recent" for the unread dot.
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const SEVERITY_DOT: Record<ActivityLog["severity"], string> = {
  error: "bg-destructive",
  info: "bg-muted-foreground",
  success: "bg-emerald-500",
  warn: "bg-amber-500",
};

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

function isRecent(iso: string): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < RECENT_WINDOW_MS;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, refetch } = useActivity("all");

  const items = data ?? [];
  const visible = items.slice(0, MAX_ITEMS);
  const recentCount = items.filter((i) => isRecent(i.createdAt)).length;
  const badgeLabel = recentCount > 9 ? "9+" : String(recentCount);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void refetch();
  };

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={
            recentCount > 0
              ? `Notifications, ${recentCount} recent`
              : "Notifications"
          }
          className="relative h-8 w-8"
          size="icon"
          variant="ghost"
        >
          <Bell className="h-4 w-4" />
          {recentCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background">
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-[#2a2a2a]">
          <span className="text-sm font-semibold text-foreground">
            Notifications
          </span>
          {recentCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {recentCount} recent
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton className="h-12 w-full" key={i} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                You&apos;re all caught up
              </p>
              <p className="max-w-[15rem] text-xs text-muted-foreground">
                Activity from RFQs, quotations, approvals, and invoices will
                show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border dark:divide-[#2a2a2a]">
              {visible.map((event) => (
                <li
                  className="flex items-start gap-3 px-4 py-3"
                  key={event._id}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      SEVERITY_DOT[event.severity]
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-foreground">
                      {event.message}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {relativeTime(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-2 dark:border-[#2a2a2a]">
          <Link
            className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-muted"
            href="/activity"
            onClick={() => setOpen(false)}
          >
            View all activity
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
