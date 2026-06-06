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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateVendor, useUpdateVendor } from "@/hooks/vb/use-vendors";
import type { CreateVendorResponse, Vendor } from "@/lib/vb-types";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this vendor instead of creating one. */
  vendor?: Vendor | null;
}

interface FormState {
  name: string;
  category: string;
  email: string;
  contactPerson: string;
  phone: string;
  gstNumber: string;
}

const EMPTY: FormState = {
  name: "",
  category: "",
  email: "",
  contactPerson: "",
  phone: "",
  gstNumber: "",
};

export function VendorFormDialog({ open, onOpenChange, vendor }: Props) {
  const isEdit = Boolean(vendor);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [result, setResult] = useState<CreateVendorResponse | null>(null);
  const create = useCreateVendor();
  const update = useUpdateVendor();
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setResult(null);
      setForm(
        vendor
          ? {
              name: vendor.name ?? "",
              category: vendor.category ?? "",
              email: vendor.email ?? "",
              contactPerson: vendor.contactPerson ?? "",
              phone: vendor.phone ?? "",
              gstNumber: vendor.gstNumber ?? "",
            }
          : EMPTY
      );
    }
  }, [open, vendor]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return "Name must be at least 2 characters";
    if (!form.category.trim()) return "Category is required";
    if (!isEdit && !/^[\w.-]+@[\w.-]+\.\w+$/.test(form.email))
      return "A valid email is required";
    if (form.phone && !/^[0-9]{7,15}$/.test(form.phone))
      return "Phone must be 7–15 digits";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      if (isEdit && vendor) {
        await update.mutateAsync({
          id: vendor._id,
          name: form.name.trim(),
          category: form.category.trim(),
          contactPerson: form.contactPerson.trim() || undefined,
          phone: form.phone.trim() || undefined,
          gstNumber: form.gstNumber.trim() || undefined,
        });
      } else {
        const res = await create.mutateAsync({
          name: form.name.trim(),
          category: form.category.trim(),
          email: form.email.trim(),
          contactPerson: form.contactPerson.trim() || undefined,
          phone: form.phone.trim() || undefined,
          gstNumber: form.gstNumber.trim() || undefined,
        });
        // keep the dialog open and reveal the portal credentials to share
        setResult(res);
        return;
      }
      onOpenChange(false);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        {result ? (
          <CredentialsView result={result} onDone={() => onOpenChange(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit vendor" : "Add vendor"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Update vendor details. Email cannot be changed after creation."
                  : "Create a vendor — we'll provision portal login credentials you can share immediately."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block" htmlFor="v-name">
              Vendor name *
            </Label>
            <Input
              id="v-name"
              onChange={set("name")}
              placeholder="Acme Furniture Pvt Ltd"
              value={form.name}
            />
          </div>
          <div>
            <Label className="mb-1.5 block" htmlFor="v-category">
              Category *
            </Label>
            <Input
              id="v-category"
              onChange={set("category")}
              placeholder="Furniture"
              value={form.category}
            />
          </div>
          <div>
            <Label className="mb-1.5 block" htmlFor="v-contact">
              Contact person
            </Label>
            <Input
              id="v-contact"
              onChange={set("contactPerson")}
              placeholder="Priya Sharma"
              value={form.contactPerson}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block" htmlFor="v-email">
              Email *
            </Label>
            <Input
              disabled={isEdit}
              id="v-email"
              onChange={set("email")}
              placeholder="sales@acme.com"
              type="email"
              value={form.email}
            />
          </div>
          <div>
            <Label className="mb-1.5 block" htmlFor="v-phone">
              Phone
            </Label>
            <Input
              id="v-phone"
              onChange={set("phone")}
              placeholder="9876543210"
              value={form.phone}
            />
          </div>
          <div>
            <Label className="mb-1.5 block" htmlFor="v-gst">
              GST number
            </Label>
            <Input
              id="v-gst"
              onChange={set("gstNumber")}
              placeholder="22AAAAA0000A1Z5"
              value={form.gstNumber}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={pending} onClick={handleSubmit}>
            {pending
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create vendor"}
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

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

function CredentialsView({
  result,
  onDone,
}: {
  result: CreateVendorResponse;
  onDone: () => void;
}) {
  const { vendor, credentials, emailSent, accountExisted } = result;
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
    <>
      <DialogHeader>
        <DialogTitle>{vendor.name} is ready</DialogTitle>
        <DialogDescription>
          {accountExisted
            ? "This person already had an account — share the portal link; they log in with their existing password."
            : "Share these credentials so the vendor can log in to the portal directly."}
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
        <Button onClick={onDone} type="button">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
