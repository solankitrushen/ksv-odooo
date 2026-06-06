"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper, StepperFooter } from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/textarea";
import { VendorStatusBadge } from "@/components/features/vb/status-badges";
import { useCreateRfq } from "@/hooks/vb/use-rfqs";
import { useVendors } from "@/hooks/vb/use-vendors";
import type { CreateRfqInput, RfqItem, RfqPriority } from "@/lib/vb-types";
import { Info, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const STEPS = [
  { id: "details", label: "Details" },
  { id: "items", label: "Line items" },
  { id: "vendors", label: "Vendors" },
  { id: "review", label: "Review" },
];

interface DraftItem extends RfqItem {
  _key: string;
}

function newItem(): DraftItem {
  return { _key: crypto.randomUUID(), name: "", qty: 1, unit: "" };
}

/** Default deadline = 7 days out, formatted for <input type="datetime-local">. */
function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function RfqWizard() {
  const router = useRouter();
  const create = useCreateRfq();
  const { data: vendors, isLoading: vendorsLoading } = useVendors("active");

  const [step, setStep] = useState(0);

  // step 1 — details
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<RfqPriority>("medium");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [description, setDescription] = useState("");

  // step 2 — items
  const [items, setItems] = useState<DraftItem[]>([newItem()]);

  // step 3 — vendors
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  // step 4 — publish mode
  const [publishActive, setPublishActive] = useState(true);

  const validItems = useMemo(
    () =>
      items.filter(
        (it) => it.name.trim() && it.unit.trim() && Number(it.qty) >= 1
      ),
    [items]
  );

  const deadlineValid = useMemo(() => {
    const t = new Date(deadline).getTime();
    return Number.isFinite(t) && t > Date.now();
  }, [deadline]);

  const stepValid = (s: number): boolean => {
    switch (s) {
      case 0:
        return title.trim().length >= 2 && !!category.trim() && deadlineValid;
      case 1:
        return validItems.length > 0;
      case 2:
        // vendors optional for a draft; required only when publishing active
        return true;
      default:
        return true;
    }
  };

  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((prev) =>
      prev.map((it) => (it._key === key ? { ...it, ...patch } : it))
    );

  const toggleVendor = (id: string) =>
    setSelectedVendors((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );

  const goNext = () => {
    if (!stepValid(step)) {
      toast.error("Complete the required fields before continuing");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSubmit = async () => {
    if (publishActive && selectedVendors.length === 0) {
      toast.error("An active RFQ needs at least one assigned vendor");
      setStep(2);
      return;
    }
    const payload: CreateRfqInput = {
      title: title.trim(),
      category: category.trim(),
      deadline: new Date(deadline).toISOString(),
      items: validItems.map(({ name, qty, unit }) => ({
        name: name.trim(),
        qty: Number(qty),
        unit: unit.trim(),
      })),
      description: description.trim() || undefined,
      priority,
      assignedVendorIds: selectedVendors,
      status: publishActive ? "active" : "draft",
    };
    try {
      const res = await create.mutateAsync(payload);
      router.push(`/rfqs/${res.rfq._id}`);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <div className="space-y-6">
      <Stepper
        allowJump
        currentStep={step}
        linear
        onStepChange={(i) => {
          // allow jumping back, or forward only if prior steps valid
          if (i <= step || stepValid(step)) setStep(i);
        }}
        steps={STEPS}
      />

      <div className="rounded-xl border border-border bg-card p-5 dark:border-[#2a2a2a] dark:bg-panel">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block" htmlFor="rfq-title">
                Title *
              </Label>
              <Input
                id="rfq-title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Office furniture procurement Q3"
                value={title}
              />
            </div>
            <div>
              <Label className="mb-1.5 block" htmlFor="rfq-category">
                Category *
              </Label>
              <Input
                id="rfq-category"
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Furniture"
                value={category}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Priority</Label>
              <Select
                onValueChange={(v) => setPriority(v as RfqPriority)}
                value={priority}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block" htmlFor="rfq-deadline">
                Submission deadline *
              </Label>
              <Input
                id="rfq-deadline"
                onChange={(e) => setDeadline(e.target.value)}
                type="datetime-local"
                value={deadline}
              />
              {!deadlineValid && (
                <p className="mt-1 text-xs text-destructive">
                  Deadline must be in the future.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block" htmlFor="rfq-desc">
                Description
              </Label>
              <Textarea
                id="rfq-desc"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Context, delivery expectations, compliance notes…"
                rows={4}
                value={description}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_90px_120px_40px] gap-2 px-1 text-xs font-medium text-muted-foreground">
              <span>Item name</span>
              <span>Qty</span>
              <span>Unit</span>
              <span />
            </div>
            {items.map((it) => (
              <div
                className="grid grid-cols-[1fr_90px_120px_40px] items-center gap-2"
                key={it._key}
              >
                <Input
                  onChange={(e) => updateItem(it._key, { name: e.target.value })}
                  placeholder="Ergonomic chair"
                  value={it.name}
                />
                <Input
                  min={1}
                  onChange={(e) =>
                    updateItem(it._key, { qty: Number(e.target.value) })
                  }
                  type="number"
                  value={it.qty}
                />
                <Input
                  onChange={(e) => updateItem(it._key, { unit: e.target.value })}
                  placeholder="pcs"
                  value={it.unit}
                />
                <Button
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((prev) => prev.filter((x) => x._key !== it._key))
                  }
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              onClick={() => setItems((prev) => [...prev, newItem()])}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
            <p className="text-xs text-muted-foreground">
              {validItems.length} valid item
              {validItems.length === 1 ? "" : "s"}. Each needs a name, quantity
              (≥1), and unit.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Only active vendors can be assigned. Vendors receive the RFQ in
                their portal once it is published as active.
              </AlertDescription>
            </Alert>
            {vendorsLoading ? (
              <p className="text-sm text-muted-foreground">Loading vendors…</p>
            ) : (vendors ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active vendors yet. You can still save this RFQ as a draft and
                assign vendors later.
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2 dark:border-[#2a2a2a]">
                {(vendors ?? []).map((v) => (
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50"
                    key={v._id}
                  >
                    <Checkbox
                      checked={selectedVendors.includes(v._id)}
                      onCheckedChange={() => toggleVendor(v._id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {v.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.category} · {v.email}
                      </p>
                    </div>
                    <VendorStatusBadge status={v.status} />
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedVendors.length} vendor
              {selectedVendors.length === 1 ? "" : "s"} selected.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewRow label="Title" value={title} />
              <ReviewRow label="Category" value={category} />
              <ReviewRow label="Priority" value={priority} />
              <ReviewRow
                label="Deadline"
                value={new Date(deadline).toLocaleString()}
              />
              <ReviewRow
                label="Items"
                value={`${validItems.length} line item(s)`}
              />
              <ReviewRow
                label="Vendors"
                value={`${selectedVendors.length} assigned`}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 dark:border-[#2a2a2a]">
              <Checkbox
                checked={publishActive}
                onCheckedChange={(c) => setPublishActive(Boolean(c))}
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Publish as active
                </p>
                <p className="text-xs text-muted-foreground">
                  Active RFQs are immediately visible to assigned vendors and
                  require at least one vendor. Uncheck to save as a draft.
                </p>
              </div>
            </label>

            {publishActive && selectedVendors.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangleIcon />
                <AlertDescription>
                  Assign at least one vendor or save as a draft instead.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="mt-6">
          <StepperFooter
            currentStep={step}
            isSubmitting={create.isPending}
            nextDisabled={!stepValid(step)}
            onBack={() => setStep((s) => Math.max(0, s - 1))}
            onNext={goNext}
            onSubmit={handleSubmit}
            submitLabel={publishActive ? "Publish RFQ" : "Save draft"}
            totalSteps={STEPS.length}
          />
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 dark:border-[#2a2a2a]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">
        {value || "—"}
      </p>
    </div>
  );
}

function AlertTriangleIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
