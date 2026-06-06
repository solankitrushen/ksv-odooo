"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { CreateVendorResponse } from "@/lib/vb-types";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-sm dark:border-[#2a2a2a]">
          {value}
        </code>
        <Button onClick={copy} size="icon" type="button" variant="outline">
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

interface Props {
  result: CreateVendorResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorCredentialsDialog({ result, open, onOpenChange }: Props) {
  if (!result) return null;
  const { vendor, credentials, emailSent } = result;

  const copyAll = async () => {
    const lines = [
      `Portal: ${credentials.portalUrl}`,
      `Email: ${credentials.email}`,
      credentials.tempPassword
        ? `Temporary password: ${credentials.tempPassword}`
        : `Password: use your existing account password`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      toast.success("Credentials copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Portal access for {vendor.name}</DialogTitle>
          <DialogDescription>
            Share these with the vendor so they can log in directly.
            {emailSent
              ? " We've also emailed them."
              : " (Email not sent — SMTP not configured; share manually.)"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <CopyField label="Portal link" value={credentials.portalUrl} />
          <CopyField label="Email" value={credentials.email} />
          {credentials.tempPassword ? (
            <CopyField
              label="Temporary password"
              value={credentials.tempPassword}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Existing account — no new password was generated.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={copyAll} type="button" variant="outline">
            <Copy className="h-4 w-4" />
            Copy all
          </Button>
          <Button onClick={() => onOpenChange(false)} type="button">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
