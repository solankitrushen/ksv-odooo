"use client";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useOnboardStoreRazorpay,
  useSyncStoreRazorpay,
  useUpdateStoreRazorpay,
} from "@/hooks/use-stores";
import type { RazorpayOnboardingStatus, Store } from "@/lib/api-types";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Props {
  store: Store;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABEL: Record<RazorpayOnboardingStatus, string> = {
  active: "Active",
  created: "Created",
  needs_clarification: "Needs clarification",
  pending: "Pending",
  rejected: "Rejected",
  suspended: "Suspended",
  under_review: "Under review",
};

const STATUS_VARIANT: Record<
  RazorpayOnboardingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  created: "secondary",
  needs_clarification: "destructive",
  pending: "secondary",
  rejected: "destructive",
  suspended: "destructive",
  under_review: "secondary",
};

export function StoreRazorpayDialog({ store, open, onOpenChange }: Props) {
  const update = useUpdateStoreRazorpay();
  const onboard = useOnboardStoreRazorpay();
  const sync = useSyncStoreRazorpay();

  const isConnected = Boolean(store.razorpay?.linkedAccountId);
  const status: RazorpayOnboardingStatus =
    store.razorpay?.onboardingStatus ?? "pending";

  const [commissionPercent, setCommissionPercent] = useState<string>("15");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<string>("proprietorship");
  const [pan, setPan] = useState("");
  const [gst, setGst] = useState("");
  const [addrStreet1, setAddrStreet1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostal, setAddrPostal] = useState("");

  useEffect(() => {
    if (!open) return;
    const rp = store.razorpay;
    setCommissionPercent(String(rp?.commissionPercent ?? 15));
    setBeneficiaryName(rp?.beneficiaryName ?? "");
    setContactName(rp?.contactName ?? store.owner?.name ?? "");
    setContactEmail(rp?.contactEmail ?? store.email);
    setContactPhone(rp?.contactPhone ?? store.phone);
    setBankAccountNumber("");
    setIfscCode(rp?.ifscCode ?? "");
    setLegalBusinessName(rp?.legalBusinessName ?? store.name);
    setBusinessType(rp?.businessType ?? "proprietorship");
    setPan("");
    setGst("");
    setAddrStreet1(rp?.address?.street1 ?? store.address?.street ?? "");
    setAddrCity(rp?.address?.city ?? store.address?.city ?? "");
    setAddrState(rp?.address?.state ?? "");
    setAddrPostal(rp?.address?.postalCode ?? store.address?.zipCode ?? "");
  }, [open, store]);

  const busy = update.isPending || onboard.isPending;

  const validate = (): string | null => {
    const pct = Number(commissionPercent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return "Commission % must be 0-100";
    }
    if (!isConnected) {
      if (!legalBusinessName) return "Legal business name required to connect";
      if (!pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        return "Valid PAN required to connect (ABCDE1234F)";
      }
      if (!addrStreet1 || !addrCity || !addrPostal) {
        return "Full registered address required to connect";
      }
      if (!/^[0-9]{6}$/.test(addrPostal)) return "Postal must be 6 digits";
      if (gst && !/^[0-9A-Z]{15}$/.test(gst)) return "GSTIN must be 15 chars";
      if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        return "IFSC format invalid";
      }
    } else {
      if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return "PAN invalid";
      if (gst && !/^[0-9A-Z]{15}$/.test(gst)) return "GSTIN invalid";
      if (ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        return "IFSC invalid";
      }
    }
    return null;
  };

  const buildPatch = () => ({
    id: store._id,
    commissionPercent: Number(commissionPercent),
    beneficiaryName: beneficiaryName || undefined,
    contactName: contactName || undefined,
    contactEmail: contactEmail || undefined,
    contactPhone: contactPhone || undefined,
    bankAccountNumber: bankAccountNumber || undefined,
    ifscCode: ifscCode || undefined,
    legalBusinessName: legalBusinessName || undefined,
    businessType: businessType || undefined,
    pan: pan || undefined,
    gst: gst || undefined,
    address:
      addrStreet1 || addrCity || addrState || addrPostal
        ? {
            street1: addrStreet1 || undefined,
            city: addrCity || undefined,
            state: addrState || undefined,
            postalCode: addrPostal || undefined,
            country: "IN",
          }
        : undefined,
  });

  const handlePrimary = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    // Always persist current edits first.
    await update.mutateAsync(buildPatch());
    // If not yet connected, chain onboarding so admin sees one action.
    if (!isConnected) {
      await onboard.mutateAsync(store._id);
    }
    onOpenChange(false);
  };

  const primaryLabel = useMemo(() => {
    if (isConnected) return update.isPending ? "Saving…" : "Save changes";
    if (onboard.isPending) return "Connecting…";
    if (update.isPending) return "Saving…";
    return "Connect Razorpay";
  }, [isConnected, update.isPending, onboard.isPending]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Razorpay payout split</DialogTitle>
          <DialogDescription>
            Commission % is charged to the customer as a separate
            &ldquo;Platform fee&rdquo; line on top of the cart subtotal.
            The merchant receives the full subtotal at payout; the
            platform keeps the fee plus delivery charges.
          </DialogDescription>
        </DialogHeader>

        {isConnected && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3 dark:border-[#2a2a2a]">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">LinkedAccount</p>
              <p className="font-mono text-sm break-all">
                {store.razorpay?.linkedAccountId}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[status]}>
              {STATUS_LABEL[status]}
            </Badge>
            <Button
              disabled={sync.isPending}
              onClick={() => sync.mutateAsync(store._id)}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {sync.isPending ? "Syncing…" : "Sync status"}
            </Button>
          </div>
        )}

        {!isConnected && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Not connected yet. Fill the legal &amp; address fields below, then
            click <b>Connect Razorpay</b>. We create the LinkedAccount via
            Razorpay API and save credentials here — owner does nothing.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block" htmlFor="rp-pct">
              Platform fee % (customer pays this on top)
            </Label>
            <Input
              id="rp-pct"
              max={100}
              min={0}
              onChange={(e) => setCommissionPercent(e.target.value)}
              type="number"
              value={commissionPercent}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Cart subtotal ₹X → customer sees a ₹{`${(Number(commissionPercent) || 0)}`}%
              platform-fee line and pays X + fee. Merchant receives full
              subtotal at payout. Change anytime — applies to next order.
            </p>
          </div>

          <div className="rounded-md border border-border p-3 dark:border-[#2a2a2a]">
            <p className="mb-2 text-xs font-semibold">Legal &amp; KYC</p>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block" htmlFor="rp-legal-name">
                  Legal business name
                </Label>
                <Input
                  id="rp-legal-name"
                  onChange={(e) => setLegalBusinessName(e.target.value)}
                  value={legalBusinessName}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block" htmlFor="rp-business-type">
                    Business type
                  </Label>
                  <Select
                    onValueChange={(v) => setBusinessType(v)}
                    value={businessType}
                  >
                    <SelectTrigger id="rp-business-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proprietorship">
                        Proprietorship
                      </SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                      <SelectItem value="private_limited">
                        Private Ltd
                      </SelectItem>
                      <SelectItem value="public_limited">Public Ltd</SelectItem>
                      <SelectItem value="llp">LLP</SelectItem>
                      <SelectItem value="ngo">NGO</SelectItem>
                      <SelectItem value="trust">Trust</SelectItem>
                      <SelectItem value="society">Society</SelectItem>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="not_yet_registered">
                        Not yet registered
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block" htmlFor="rp-pan">
                    PAN
                  </Label>
                  <Input
                    id="rp-pan"
                    maxLength={10}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder={
                      isConnected ? "Re-enter to update" : "ABCDE1234F"
                    }
                    value={pan}
                  />
                  {isConnected && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Stored encrypted — re-type only to change.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block" htmlFor="rp-gst">
                  GSTIN (optional)
                </Label>
                <Input
                  id="rp-gst"
                  maxLength={15}
                  onChange={(e) => setGst(e.target.value.toUpperCase())}
                  placeholder={
                    isConnected ? "Re-enter to update" : "22AAAAA0000A1Z5"
                  }
                  value={gst}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border p-3 dark:border-[#2a2a2a]">
            <p className="mb-2 text-xs font-semibold">Registered address</p>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block" htmlFor="rp-addr1">
                  Street
                </Label>
                <Input
                  id="rp-addr1"
                  onChange={(e) => setAddrStreet1(e.target.value)}
                  value={addrStreet1}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1.5 block" htmlFor="rp-city">
                    City
                  </Label>
                  <Input
                    id="rp-city"
                    onChange={(e) => setAddrCity(e.target.value)}
                    value={addrCity}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block" htmlFor="rp-state">
                    State
                  </Label>
                  <Input
                    id="rp-state"
                    onChange={(e) =>
                      setAddrState(e.target.value.toUpperCase())
                    }
                    placeholder="KARNATAKA"
                    value={addrState}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block" htmlFor="rp-postal">
                    Postal
                  </Label>
                  <Input
                    id="rp-postal"
                    maxLength={6}
                    onChange={(e) => setAddrPostal(e.target.value)}
                    value={addrPostal}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block" htmlFor="rp-beneficiary">
                Beneficiary name
              </Label>
              <Input
                id="rp-beneficiary"
                onChange={(e) => setBeneficiaryName(e.target.value)}
                value={beneficiaryName}
              />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="rp-contact-name">
                Contact name
              </Label>
              <Input
                id="rp-contact-name"
                onChange={(e) => setContactName(e.target.value)}
                value={contactName}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block" htmlFor="rp-email">
                Contact email
              </Label>
              <Input
                id="rp-email"
                onChange={(e) => setContactEmail(e.target.value)}
                type="email"
                value={contactEmail}
              />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="rp-phone">
                Contact phone
              </Label>
              <Input
                id="rp-phone"
                onChange={(e) => setContactPhone(e.target.value)}
                value={contactPhone}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block" htmlFor="rp-bank">
                Bank account #
              </Label>
              <Input
                id="rp-bank"
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder={
                  isConnected ? "Re-enter to update" : "Account number"
                }
                value={bankAccountNumber}
              />
              {isConnected && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Stored encrypted — re-type only to change.
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="rp-ifsc">
                IFSC
              </Label>
              <Input
                id="rp-ifsc"
                maxLength={11}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                value={ifscCode}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={busy} onClick={handlePrimary}>
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
