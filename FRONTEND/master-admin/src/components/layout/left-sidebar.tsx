"use client";

import { cn } from "@/lib/utils";
import {
  SIDEBAR_NAV,
  navForRoles,
  isNavSection,
  type SidebarNavItem,
} from "@/constants/nav.constants";
import { useAuth } from "@/contexts/auth-context";
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function getExpandedFromPath(pathname: string): string | null {
  for (const item of SIDEBAR_NAV) {
    if (isNavSection(item)) {
      const active = item.children.some(
        (c) => pathname === c.href || pathname.startsWith(c.href + "/")
      );
      if (active) return item.label;
    }
  }
  return null;
}

function Initials({ email, name }: { email: string; name: string }) {
  const parts = name.trim().split(" ").filter(Boolean);
  const text =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : name.slice(0, 2) || email.slice(0, 2);
  return <>{text.toUpperCase()}</>;
}

export function LeftSidebar({
  onSettingsOpenChange,
}: {
  onSettingsOpenChange: (open: boolean) => void;
  settingsInitialPanel: string | null;
  settingsOpen: boolean;
}) {
  const pathname = usePathname();
  const { user, roles } = useAuth();
  const navItems = useMemo(() => navForRoles(roles), [roles]);

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const [expanded, setExpanded] = useState<string | null>(() =>
    getExpandedFromPath(pathname)
  );
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  const expandedSection = useMemo(() => {
    if (expanded !== null) return expanded;
    const pathBased = getExpandedFromPath(pathname);
    if (pathBased && !collapsedSections.includes(pathBased)) return pathBased;
    return null;
  }, [expanded, pathname, collapsedSections]);

  const toggleExpanded = (label: string) => {
    const next = expandedSection === label ? null : label;
    if (next === null)
      setCollapsedSections((s) => (s.includes(label) ? s : [...s, label]));
    else setCollapsedSections((s) => s.filter((x) => x !== label));
    setExpanded(next);
  };

  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      user.name ||
      user.email ||
      "User"
    : "User";
  const email = user?.email ?? "";

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col h-full bg-[var(--sidebar-hex)] dark:bg-[#111111] border-r border-border dark:border-[#1e1e1e] transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-[52px]" : "w-60"
      )}
    >
      {collapsed ? (
        <button
          className="flex h-[49px] w-full shrink-0 items-center justify-center border-b border-border dark:border-[#1e1e1e] hover:bg-accent/40 transition-colors"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          type="button"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            V
          </div>
        </button>
      ) : (
        <div className="flex h-[49px] shrink-0 items-center border-b border-border dark:border-[#1e1e1e] px-3 gap-2">
          <Link
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold"
            href="/dashboard"
          >
            V
          </Link>
          <span className="flex-1 truncate text-sm font-semibold tracking-tight text-foreground">
            VendorBridge
          </span>
          <button
            aria-label="Collapse sidebar"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            type="button"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-3">
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item: SidebarNavItem) => {
            if (isNavSection(item)) {
              const isExp = expandedSection === item.label;
              const hasActive = item.children.some(
                (c) =>
                  pathname === c.href || pathname.startsWith(c.href + "/")
              );
              return (
                <div key={item.label}>
                  <button
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      hasActive
                        ? "bg-accent text-foreground dark:bg-white/[0.07] dark:text-white"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground dark:hover:bg-white/[0.05]"
                    )}
                    onClick={() => {
                      if (collapsed) {
                        setCollapsed(false);
                        return;
                      }
                      toggleExpanded(item.label);
                    }}
                    title={collapsed ? item.label : undefined}
                    type="button"
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {isExp ? (
                          <ChevronDown
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            strokeWidth={2}
                          />
                        ) : (
                          <ChevronRight
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            strokeWidth={2}
                          />
                        )}
                      </>
                    )}
                  </button>
                  {!collapsed && isExp && (
                    <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border/60 pl-3 dark:border-[#2a2a2a]">
                      {item.children.map((child) => {
                        const active =
                          pathname === child.href ||
                          pathname.startsWith(child.href + "/");
                        return (
                          <Link
                            className={cn(
                              "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                              active
                                ? "font-medium text-foreground dark:text-white"
                                : "text-muted-foreground hover:text-foreground dark:hover:text-white"
                            )}
                            href={child.href}
                            key={child.href}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-accent text-foreground dark:bg-white/[0.07] dark:text-white"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground dark:hover:bg-white/[0.05]"
                )}
                href={item.href}
                key={item.href}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 border-t border-border dark:border-[#1e1e1e] p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E91E63] text-xs font-semibold text-white"
              title={displayName}
            >
              <Initials email={email} name={displayName} />
            </div>
            <button
              aria-label="Settings"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => onSettingsOpenChange(true)}
              title="Settings"
              type="button"
            >
              <Settings className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E91E63] text-xs font-semibold text-white">
              <Initials email={email} name={displayName} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground dark:text-white leading-tight">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">
                {email}
              </p>
            </div>
            <button
              aria-label="Settings"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => onSettingsOpenChange(true)}
              type="button"
            >
              <Settings className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
