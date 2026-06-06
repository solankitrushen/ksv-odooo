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
  Ticket,
} from "lucide-react";

export const HEADER_ROUTES: { href: string; icon: LucideIcon; label: string }[] =
  [];

export type VbRole = "admin" | "officer" | "manager" | "vendor";

export type SidebarNavLink = {
  children?: never;
  href: string;
  icon: LucideIcon;
  label: string;
  /** Roles allowed to see this item. Omit = all roles. */
  roles?: VbRole[];
};

export type SidebarNavSection = {
  children: { href: string; label: string }[];
  href?: never;
  icon: LucideIcon;
  label: string;
  roles?: VbRole[];
};

export type SidebarNavItem = SidebarNavLink | SidebarNavSection;

export function isNavSection(item: SidebarNavItem): item is SidebarNavSection {
  return "children" in item && Array.isArray(item.children);
}

const STAFF: VbRole[] = ["admin", "officer", "manager"];

export const SIDEBAR_NAV: SidebarNavItem[] = [
  // Dashboard is role-aware (vendor sees their own dashboard) — visible to all.
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/vendors", icon: Building2, label: "Vendors", roles: ["admin", "officer"] },
  // RFQs page shows assigned RFQs to vendors, all RFQs to staff.
  { href: "/rfqs", icon: FileText, label: "RFQs" },
  // Quotations: staff see comparison; vendors see their own quotations.
  { href: "/quotations", icon: GitCompare, label: "Quotations" },
  { href: "/approvals", icon: CheckSquare, label: "Approvals", roles: ["admin", "manager"] },
  // Vendors view their own POs/invoices; staff view all.
  { href: "/purchase-orders", icon: ShoppingCart, label: "Purchase orders" },
  { href: "/invoices", icon: Receipt, label: "Invoices" },
  { href: "/reports", icon: BarChart3, label: "Reports", roles: STAFF },
  { href: "/activity", icon: Activity, label: "Activity", roles: STAFF },
  // Tickets: staff manage; vendors see/reply to their negotiation tickets.
  { href: "/tickets", icon: Ticket, label: "Tickets" },
];

/** Filter nav items to those the given roles may see. */
export function navForRoles(roles: VbRole[]): SidebarNavItem[] {
  return SIDEBAR_NAV.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r))
  );
}

export const SIDEBAR_STORAGE_ICON = LayoutDashboard;
