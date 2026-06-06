"use client";

import { VendorFormDialog } from "@/components/features/vb/vendor-form-dialog";
import { VendorsTable } from "@/components/features/vb/vendors-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/contexts/page-title-context";
import {
  useVendors,
  type VendorStatusFilter,
} from "@/hooks/vb/use-vendors";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

export default function VendorsPage() {
  const [filter, setFilter] = useState<VendorStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const { setPageTitle } = usePageTitle();
  const { data, error, isError, isLoading, refetch } = useVendors(
    filter,
    search
  );

  useEffect(() => {
    setPageTitle({
      description: "Invite, manage, and assign vendors for RFQs",
      title: "Vendors",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          onValueChange={(v) => setFilter(v as VendorStatusFilter)}
          value={filter}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="invited">Invited</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-64 pl-9"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor name"
              value={search}
            />
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add vendor
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load vendors</AlertTitle>
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
        !isError && (
          <VendorsTable onAdd={() => setAddOpen(true)} vendors={data ?? []} />
        )
      )}

      <VendorFormDialog onOpenChange={setAddOpen} open={addOpen} />
    </div>
  );
}
