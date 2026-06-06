import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Building2,
  CheckSquare,
  FileText,
  GitCompare,
  LayoutDashboard,
  Receipt,
  ShoppingCart,
} from "lucide-react";

export const HEADER_ROUTES: { href: string; icon: LucideIcon; label: string }[] =
  [];

export type SidebarNavLink = {
  children?: never;
  href: string;
  icon: LucideIcon;
  label: string;
};

export type SidebarNavSection = {
  children: { href: string; label: string }[];
  href?: never;
  icon: LucideIcon;
  label: string;
};

export type SidebarNavItem = SidebarNavLink | SidebarNavSection;

export function isNavSection(item: SidebarNavItem): item is SidebarNavSection {
  return "children" in item && Array.isArray(item.children);
}

export const SIDEBAR_NAV: SidebarNavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/vendors", icon: Building2, label: "Vendors" },
  { href: "/rfqs", icon: FileText, label: "RFQs" },
  { href: "/quotations", icon: GitCompare, label: "Quotations" },
  { href: "/approvals", icon: CheckSquare, label: "Approvals" },
  { href: "/purchase-orders", icon: ShoppingCart, label: "Purchase orders" },
  { href: "/invoices", icon: Receipt, label: "Invoices" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/activity", icon: Activity, label: "Activity" },
];

export const SIDEBAR_STORAGE_ICON = LayoutDashboard;
