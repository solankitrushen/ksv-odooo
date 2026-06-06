"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface Props {
  onChange: (range: DateRange | undefined) => void;
  value: DateRange | undefined;
}

export function DateRangePicker({ onChange, value }: Props) {
  const label =
    value?.from && value?.to
      ? `${format(value.from, "MMM d")} – ${format(value.to, "MMM d, yyyy")}`
      : value?.from
        ? format(value.from, "MMM d, yyyy")
        : "Pick a date range";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "w-full justify-start text-left font-normal border border-input bg-background dark:bg-[#1c1c1c] md:w-[280px]",
            !value?.from && "text-muted-foreground"
          )}
          variant="outline"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 bg-background dark:bg-[#1a1a1d] border border-border dark:border-[#2a2a2a]"
      >
        <Calendar
          defaultMonth={value?.from}
          initialFocus
          mode="range"
          numberOfMonths={2}
          onSelect={onChange}
          selected={value}
        />
      </PopoverContent>
    </Popover>
  );
}
