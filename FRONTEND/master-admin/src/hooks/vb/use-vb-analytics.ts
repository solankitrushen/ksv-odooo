"use client";

import { apiFetch } from "@/lib/backend-fetch";
import type { VbAnalyticsDashboard } from "@/lib/vb-types";
import { useQuery } from "@tanstack/react-query";

export function useVbDashboard(enabled = true) {
  return useQuery({
    enabled,
    queryFn: () =>
      apiFetch<VbAnalyticsDashboard>("/vb/analytics/dashboard"),
    queryKey: ["vb", "analytics", "dashboard"],
    staleTime: 30_000,
  });
}

export interface VendorDashboard {
  rfqs: { assigned: number };
  quotations: {
    draft: number;
    submitted: number;
    withdrawn: number;
    expired: number;
    total: number;
  };
  won: { count: number; value: number };
  purchaseOrders: number;
  invoices: number;
  recentRfqs: Array<{
    _id: string;
    reference: string;
    title: string;
    deadline: string;
    priority: "low" | "medium" | "high";
    createdAt: string;
    myQuotation: {
      status: string;
      approvalStatus: string;
      grandTotal: number;
    } | null;
  }>;
}

export function useVendorDashboard() {
  return useQuery({
    queryFn: () => apiFetch<VendorDashboard>("/vb/vendor/analytics"),
    queryKey: ["vb", "vendor", "analytics"],
    staleTime: 30_000,
  });
}
