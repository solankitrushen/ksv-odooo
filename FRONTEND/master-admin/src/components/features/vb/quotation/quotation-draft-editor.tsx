"use client";

import { QuotationStatusBadge } from "@/components/features/vb/status-badges";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDownloadOwnQuotation,
  usePatchQuotation,
  useReaffirmQuotation,
  useResubmitQuotation,
  useSubmitQuotation,
  useWithdrawQuotation,
} from "@/hooks/vb/use-quotations";
import { formatPaise, paiseToInput, rupeesToPaise } from "@/lib/money";
import type {
  Quotation,
  QuotationPricingItem,
  QuotationTermsInput,
} from "@/lib/vb-types";
import { BadgeCheck, Download, RefreshCw, Save, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Props {
  quotation: Quotation;
  /**
   * Called when an action replaces the active quotation with a different one
   * (e.g. resubmit creates a new revision draft). The parent should switch the
   * workspace to edit the returned quotation.
   */
  onReplace?: (quotation: Quotation) => void;
}

interface ItemDraft {
  rfqItemId: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number | null; // paise
  taxRatePct: string;
  discountPct: string;
  hsnCode: string;
  notes: string;
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : 0;
}

export function QuotationDraftEditor({ quotation, onReplace }: Props) {
  const patch = usePatchQuotation();
  const submit = useSubmitQuotation();
  const withdraw = useWithdrawQuotation();
  const reaffirm = useReaffirmQuotation();
  const resubmit = useResubmitQuotation();
  const download = useDownloadOwnQuotation();

  const editable = quotation.status === "draft";

  const [items, setItems] = useState<ItemDraft[]>([]);
  const [terms, setTerms] = useState<QuotationTermsInput>({});
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

  useEffect(() => {
    setItems(
      quotation.items.map((it, i) => ({
        rfqItemId: it.rfqItemId ?? String(i),
        name: it.name,
        qty: it.qty,
        unit: it.unit,
        unitPrice: it.unitPrice,
        taxRatePct: String(num(it.taxRatePct)),
        discountPct: String(num(it.discountPct)),
        hsnCode: it.hsnCode ?? "",
        notes: it.notes ?? "",
      }))
    );
    setTerms({
      paymentDays: quotation.terms?.paymentDays ?? null,
      deliveryDate: quotation.terms?.deliveryDate ?? null,
      deliveryWindowText: quotation.terms?.deliveryWindowText ?? "",
      warrantyMonths: quotation.terms?.warrantyMonths ?? null,
      minOrderQty: quotation.terms?.minOrderQty ?? null,
      freeText: quotation.terms?.freeText ?? "",
    });
  }, [quotation]);

  const updateItem = (id: string, patchItem: Partial<ItemDraft>) =>
    setItems((prev) =>
      prev.map((it) => (it.rfqItemId === id ? { ...it, ...patchItem } : it))
    );

  // optimistic local total preview (server is source of truth on save)
  const localPreview = useMemo(() => {
    let subtotal = 0;
    let priced = 0;
    for (const it of items) {
      if (it.unitPrice == null) continue;
      priced += 1;
      const base = it.unitPrice * it.qty;
      const disc = base * (num(it.discountPct) / 100);
      subtotal += base - disc;
    }
    return {
      subtotal,
      coverage: items.length ? priced / items.length : 0,
    };
  }, [items]);

  const buildPricingItems = (): QuotationPricingItem[] =>
    items.map((it) => ({
      rfqItemId: it.rfqItemId,
      unitPrice: it.unitPrice,
      taxRatePct: num(it.taxRatePct),
      discountPct: num(it.discountPct),
      hsnCode: it.hsnCode.trim() || null,
      notes: it.notes.trim() || undefined,
    }));

  const buildTerms = (): QuotationTermsInput => ({
    paymentDays: terms.paymentDays ?? null,
    deliveryDate: terms.deliveryDate || null,
    deliveryWindowText: terms.deliveryWindowText?.trim() || undefined,
    warrantyMonths: terms.warrantyMonths ?? null,
    minOrderQty: terms.minOrderQty ?? null,
    freeText: terms.freeText?.trim() || undefined,
  });

  const handleSave = async () => {
    await patch.mutateAsync({
      id: quotation._id,
      items: buildPricingItems(),
      terms: buildTerms(),
    });
    toast.success("Draft saved");
  };

  const handleSubmit = async () => {
    // save first so the server has the latest pricing, then submit
    try {
      await patch.mutateAsync({
        id: quotation._id,
        items: buildPricingItems(),
        terms: buildTerms(),
      });
      await submit.mutateAsync({ id: quotation._id });
    } catch {
      /* toasts handled in hooks */
    }
  };

  const handleResubmit = async () => {
    try {
      const res = await resubmit.mutateAsync({ id: quotation._id });
      // resubmit opens a fresh editable revision draft — switch to it.
      onReplace?.(res.quotation);
    } catch {
      /* toast handled in hook */
    }
  };

  const handleReaffirm = async () => {
    try {
      await reaffirm.mutateAsync({ id: quotation._id });
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              Quotation draft
              <QuotationStatusBadge status={quotation.status} />
            </CardTitle>
            <CardDescription>
              Source: {quotation.source.replace(/-/g, " ")} · prices in{" "}
              {quotation.currency}. Totals are recomputed by the server on save.
            </CardDescription>
          </div>
          <Button
            disabled={download.isPending}
            onClick={() =>
              download.mutate({
                id: quotation._id,
                filename: `quotation-${quotation._id}.pdf`,
              })
            }
            size="sm"
            variant="outline"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-32">Unit price (₹)</TableHead>
                <TableHead className="w-20">Tax %</TableHead>
                <TableHead className="w-20">Disc %</TableHead>
                <TableHead className="w-28">HSN</TableHead>
                <TableHead className="w-32 text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const server = quotation.items.find(
                  (x) => (x.rfqItemId ?? "") === it.rfqItemId
                );
                return (
                  <TableRow key={it.rfqItemId}>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {it.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {it.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {it.qty}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        disabled={!editable}
                        inputMode="decimal"
                        onChange={(e) =>
                          updateItem(it.rfqItemId, {
                            unitPrice: rupeesToPaise(e.target.value),
                          })
                        }
                        placeholder="—"
                        type="number"
                        value={paiseToInput(it.unitPrice)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        disabled={!editable}
                        onChange={(e) =>
                          updateItem(it.rfqItemId, { taxRatePct: e.target.value })
                        }
                        type="number"
                        value={it.taxRatePct}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        disabled={!editable}
                        onChange={(e) =>
                          updateItem(it.rfqItemId, {
                            discountPct: e.target.value,
                          })
                        }
                        type="number"
                        value={it.discountPct}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        disabled={!editable}
                        onChange={(e) =>
                          updateItem(it.rfqItemId, { hsnCode: e.target.value })
                        }
                        value={it.hsnCode}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {it.unitPrice == null ? (
                        <span className="text-xs text-muted-foreground">
                          unpriced
                        </span>
                      ) : (
                        formatPaise(server?.lineTotal ?? 0, quotation.currency)
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Terms */}
      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 block">Payment days</Label>
            <Input
              disabled={!editable}
              onChange={(e) =>
                setTerms((t) => ({
                  ...t,
                  paymentDays:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              type="number"
              value={terms.paymentDays ?? ""}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Delivery date</Label>
            <Input
              disabled={!editable}
              onChange={(e) =>
                setTerms((t) => ({
                  ...t,
                  deliveryDate: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                }))
              }
              type="date"
              value={
                terms.deliveryDate
                  ? new Date(terms.deliveryDate).toISOString().slice(0, 10)
                  : ""
              }
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Warranty (months)</Label>
            <Input
              disabled={!editable}
              onChange={(e) =>
                setTerms((t) => ({
                  ...t,
                  warrantyMonths:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              type="number"
              value={terms.warrantyMonths ?? ""}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Min order qty</Label>
            <Input
              disabled={!editable}
              onChange={(e) =>
                setTerms((t) => ({
                  ...t,
                  minOrderQty:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              type="number"
              value={terms.minOrderQty ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block">Delivery window</Label>
            <Input
              disabled={!editable}
              onChange={(e) =>
                setTerms((t) => ({ ...t, deliveryWindowText: e.target.value }))
              }
              placeholder="e.g. 2–3 weeks from PO"
              value={terms.deliveryWindowText ?? ""}
            />
          </div>
          <div className="sm:col-span-3">
            <Label className="mb-1.5 block">Notes / caveats</Label>
            <Textarea
              disabled={!editable}
              onChange={(e) =>
                setTerms((t) => ({ ...t, freeText: e.target.value }))
              }
              rows={3}
              value={terms.freeText ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals + actions */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Server grand total
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatPaise(quotation.computed?.grandTotal, quotation.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              Coverage {Math.round((quotation.computed?.coverage ?? 0) * 100)}%
              {editable && (
                <>
                  {" · "}
                  unsaved preview{" "}
                  {formatPaise(localPreview.subtotal, quotation.currency)}{" "}
                  subtotal
                </>
              )}
            </p>
            {quotation.status === "submitted" && quotation.staleFlag && (
              <p className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500">
                <BadgeCheck className="h-3.5 w-3.5" />
                The RFQ changed after you submitted. Reaffirm to confirm your
                quote still stands, or resubmit a revision.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {editable ? (
              <>
                <Button
                  disabled={patch.isPending}
                  onClick={handleSave}
                  variant="outline"
                >
                  <Save className="h-4 w-4" />
                  {patch.isPending ? "Saving…" : "Save draft"}
                </Button>
                <Button
                  disabled={submit.isPending || patch.isPending}
                  onClick={handleSubmit}
                >
                  <Send className="h-4 w-4" />
                  {submit.isPending ? "Submitting…" : "Save & submit"}
                </Button>
              </>
            ) : quotation.status === "submitted" ? (
              <>
                {quotation.staleFlag && (
                  <Button
                    disabled={reaffirm.isPending}
                    onClick={handleReaffirm}
                    variant="outline"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {reaffirm.isPending ? "Reaffirming…" : "Reaffirm"}
                  </Button>
                )}
                <Button
                  disabled={resubmit.isPending}
                  onClick={handleResubmit}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4" />
                  {resubmit.isPending ? "Creating…" : "Resubmit revision"}
                </Button>
                <Button
                  disabled={withdraw.isPending}
                  onClick={() => setWithdrawOpen(true)}
                  variant="destructive"
                >
                  {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AlertDialog onOpenChange={setWithdrawOpen} open={withdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              The buyer will see it as withdrawn. Provide a brief reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            onChange={(e) => setWithdrawReason(e.target.value)}
            placeholder="Reason for withdrawal"
            rows={3}
            value={withdrawReason}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={withdraw.isPending || withdrawReason.trim().length === 0}
              onClick={async () => {
                await withdraw.mutateAsync({
                  id: quotation._id,
                  reason: withdrawReason.trim(),
                });
                setWithdrawOpen(false);
                setWithdrawReason("");
              }}
            >
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
