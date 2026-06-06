"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/features/vb/notifications-bell";
import { Sun, Moon, LogOut, Search } from "lucide-react";

function openCommandPalette() {
  window.dispatchEvent(new Event("vb:open-command-palette"));
}

export function Header() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    );
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace("/auth/login");
  };

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between gap-4 px-6 border-b border-border bg-background/95 backdrop-blur">
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
          V
        </div>
        <span className="text-base font-bold tracking-tight">VendorBridge</span>
      </Link>

      {/* Search bar (opens the command palette) */}
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Search (Command or Control + K)"
        className="group hidden h-8 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/60 sm:flex"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search pages and actions…</span>
        <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:hidden"
          onClick={openCommandPalette}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground truncate max-w-[120px]">
          {(user as { email?: string })?.email}
        </span>
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
