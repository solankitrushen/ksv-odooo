"use client";

import { apiFetch, ApiError } from "@/lib/backend-fetch";
import {
  persistAuthFlagFromResponse,
  type AuthFlagResponse,
} from "@/lib/auth-flag-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "VendorBridge Admin";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function SignupPage() {
  const [org, setOrg] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();

  const effectiveSlug = slugEdited ? slug : slugify(org);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (org.trim().length < 2) return toast.error("Organization name is required");
    if (effectiveSlug.length < 2) return toast.error("Workspace slug is required");
    if (name.trim().length < 2) return toast.error("Your name is required");
    if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(email)) return toast.error("A valid email is required");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");

    setLoading(true);
    try {
      const data = await apiFetch<AuthFlagResponse>("/vb/auth/register-tenant", {
        method: "POST",
        body: JSON.stringify({
          tenant: { name: org.trim(), slug: effectiveSlug, contactEmail: email.trim() },
          admin: { name: name.trim(), email: email.trim(), password },
        }),
      });
      if (!persistAuthFlagFromResponse(data)) {
        throw new Error("Signup response missing auth flag");
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Workspace created — welcome!");
      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Signup failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create your {APP_NAME} account</CardTitle>
        <CardDescription>
          Set up a new organization workspace. You become its admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="org">Organization name</Label>
            <Input
              id="org"
              onChange={(e) => setOrg(e.target.value)}
              placeholder="Acme Corp"
              required
              value={org}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Workspace slug</Label>
            <Input
              id="slug"
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="acme"
              value={effectiveSlug}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits, hyphens. Used to identify your workspace.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              autoComplete="new-password"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              value={password}
            />
          </div>
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-medium text-foreground hover:underline" href="/auth/login">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
