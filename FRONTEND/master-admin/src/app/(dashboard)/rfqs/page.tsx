"use client";

import { RfqsTable } from "@/components/features/vb/rfqs-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/contexts/page-title-context";
import { useAuth } from "@/contexts/auth-context";
import {
  useMyRfqInbox,
  useRfqs,
  type RfqStatusFilter,
} from "@/hooks/vb/use-rfqs";
import { AlertTriangle, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function RfqsPage() {
  const { isVendor } = useAuth();
  return isVendor ? <VendorRfqsPage /> : <StaffRfqsPage />;
}

// ---------------------------------------------------------------------------
// Vendor: assigned RFQs to reply to (with their own quotation status)
// ---------------------------------------------------------------------------
function VendorRfqsPage() {
  const [search, setSearch] = useState("");
  const { setPageTitle } = usePageTitle();
  const { data, error, isError, isLoading, refetch } = useMyRfqInbox();

  useEffect(() => {
    setPageTitle({
      description: "Reply to assigned RFQs with your quotation",
      title: "Available RFQs",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = data ?? [];
    if (!q) return items;
    return items.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-9"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, reference, category"
            value={search}
          />
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load RFQs</AlertTitle>
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
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-14 w-full" key={i} />
          ))}
        </div>
      ) : (
        !isError && <RfqsTable rfqs={filtered} vendor />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff: all RFQs + create
// ---------------------------------------------------------------------------
function StaffRfqsPage() {
  const [filter, setFilter] = useState<RfqStatusFilter>("all");
  const [search, setSearch] = useState("");
  const { setPageTitle } = usePageTitle();
  const { data, error, isError, isLoading, refetch } = useRfqs(filter);

  useEffect(() => {
    setPageTitle({
      description: "Create RFQs, assign vendors, and review quotations",
      title: "RFQs",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = data ?? [];
    if (!q) return items;
    return items.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs onValueChange={(v) => setFilter(v as RfqStatusFilter)} value={filter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-64 pl-9"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, reference, category"
              value={search}
            />
          </div>
          <Link href="/rfqs/new">
            <Button>
              <Plus className="h-4 w-4" />
              Create RFQ
            </Button>
          </Link>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load RFQs</AlertTitle>
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
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-14 w-full" key={i} />
          ))}
        </div>
      ) : (
        !isError && <RfqsTable rfqs={filtered} />
      )}
    </div>
  );
}
