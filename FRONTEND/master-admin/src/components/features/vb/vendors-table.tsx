"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VendorStatusBadge } from "@/components/features/vb/status-badges";
import { VendorFormDialog } from "@/components/features/vb/vendor-form-dialog";
import { VendorCredentialsDialog } from "@/components/features/vb/vendor-credentials-dialog";
import {
  useActivateVendor,
  useDeactivateVendor,
  useResetVendorCredentials,
} from "@/hooks/vb/use-vendors";
import type { CreateVendorResponse, Vendor } from "@/lib/vb-types";
import { format } from "date-fns";
import { Building2, KeyRound, Pencil, Ban, Power } from "lucide-react";
import { useState } from "react";

interface Props {
  vendors: Vendor[];
  onAdd: () => void;
}

function safeFormat(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy");
}

export function VendorsTable({ vendors, onAdd }: Props) {
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deactivating, setDeactivating] = useState<Vendor | null>(null);
  const [resetting, setResetting] = useState<Vendor | null>(null);
  const [creds, setCreds] = useState<CreateVendorResponse | null>(null);
  const deactivate = useDeactivateVendor();
  const activate = useActivateVendor();
  const resetCreds = useResetVendorCredentials();

  if (vendors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center dark:border-[#2a2a2a] dark:bg-panel">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          No vendors match this filter
        </h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          Add a vendor to send them an invite. Activated vendors can receive
          RFQs and submit quotations.
        </p>
        <Button onClick={onAdd} size="sm">
          Add vendor
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card dark:border-[#2a2a2a] dark:bg-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow key={v._id}>
                <TableCell className="font-medium text-foreground">
                  {v.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.category}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.contactPerson || "—"}
                  {v.phone ? (
                    <span className="block text-xs">{v.phone}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.email}
                </TableCell>
                <TableCell>
                  <VendorStatusBadge status={v.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {safeFormat(v.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      onClick={() => setEditing(v)}
                      size="sm"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      disabled={resetCreds.isPending}
                      onClick={async () => {
                        setResetting(v);
                        const res = await resetCreds.mutateAsync(v._id);
                        setResetting(null);
                        setCreds(res);
                      }}
                      size="sm"
                      variant="ghost"
                      title="Reset password & resend portal access"
                    >
                      <KeyRound className="h-4 w-4" />
                      {resetting?._id === v._id ? "Resetting…" : "Reset access"}
                    </Button>
                    {v.status === "inactive" ? (
                      <Button
                        disabled={activate.isPending}
                        onClick={() => activate.mutate(v._id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Power className="h-4 w-4 text-green-600" />
                        Activate
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setDeactivating(v)}
                        size="sm"
                        variant="ghost"
                      >
                        <Ban className="h-4 w-4" />
                        Deactivate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <VendorFormDialog
        onOpenChange={(o) => !o && setEditing(null)}
        open={Boolean(editing)}
        vendor={editing}
      />

      <VendorCredentialsDialog
        onOpenChange={(o) => !o && setCreds(null)}
        open={Boolean(creds)}
        result={creds}
      />

      <AlertDialog
        onOpenChange={(o) => !o && setDeactivating(null)}
        open={Boolean(deactivating)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {deactivating?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The vendor will no longer receive new RFQs or be assignable.
              Existing quotations are preserved. You can reactivate later via
              edit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivate.isPending}
              onClick={async () => {
                if (!deactivating) return;
                await deactivate.mutateAsync(deactivating._id);
                setDeactivating(null);
              }}
            >
              {deactivate.isPending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
