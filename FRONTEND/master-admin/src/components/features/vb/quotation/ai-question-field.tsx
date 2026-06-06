"use client";

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
import { paiseToInput, rupeesToPaise } from "@/lib/money";
import type { AiAnswerValue, AiQuestion } from "@/lib/vb-types";

interface Props {
  question: AiQuestion;
  value: AiAnswerValue | undefined;
  onChange: (value: AiAnswerValue) => void;
}

/**
 * Renders a single structured AI question as the right input for its `kind`.
 * Money is captured in rupees but emitted as integer paise (the API rejects
 * floats). Dates are emitted as ISO strings.
 */
export function AiQuestionField({ question, value, onChange }: Props) {
  const { kind, prompt, options, min, max, required } = question;

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-sm">
        {prompt}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>

      {kind === "money" && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            ₹
          </span>
          <Input
            className="pl-7"
            inputMode="decimal"
            onChange={(e) => onChange(rupeesToPaise(e.target.value))}
            placeholder="0.00"
            type="number"
            value={
              typeof value === "number" ? paiseToInput(value) : ""
            }
          />
        </div>
      )}

      {kind === "int" && (
        <Input
          max={max ?? undefined}
          min={min ?? undefined}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Math.round(Number(e.target.value)))
          }
          type="number"
          value={typeof value === "number" ? String(value) : ""}
        />
      )}

      {kind === "date" && (
        <Input
          onChange={(e) =>
            onChange(
              e.target.value ? new Date(e.target.value).toISOString() : null
            )
          }
          type="date"
          value={
            typeof value === "string" && value
              ? new Date(value).toISOString().slice(0, 10)
              : ""
          }
        />
      )}

      {kind === "enum" && (
        <Select
          onValueChange={(v) => onChange(v)}
          value={typeof value === "string" ? value : ""}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {kind === "bool" && (
        <label className="flex cursor-pointer items-center gap-2 pt-1">
          <Checkbox
            checked={value === true}
            onCheckedChange={(c) => onChange(Boolean(c))}
          />
          <span className="text-sm text-muted-foreground">Yes</span>
        </label>
      )}

      {kind === "text" && (
        <Input
          onChange={(e) => onChange(e.target.value)}
          value={typeof value === "string" ? value : ""}
        />
      )}
    </div>
  );
}
