"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { usePageTitle } from "@/contexts/page-title-context";
import { LogOut } from "lucide-react";
import { useEffect } from "react";

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle({
      description: "Your admin profile and session",
      title: "Settings",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    user?.email ||
    "Admin";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Profile</CardTitle>
          <CardDescription>
            Read-only for now. Reach out to engineering to change role or
            email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium text-foreground">{displayName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-mono text-foreground">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Role</p>
            <Badge variant="secondary">{user?.role ?? "unknown"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Security</CardTitle>
          <CardDescription>
            Password reset and 2FA are coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button disabled variant="outline">
            Change password — coming soon
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Session</CardTitle>
          <CardDescription>
            Sign out of this device. You can sign back in any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => logout()} variant="destructive">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
