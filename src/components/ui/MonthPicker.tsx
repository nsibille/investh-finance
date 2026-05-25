"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths } from "date-fns";
import { IconButton } from "./IconButton";
import { formatMonthLabel } from "@/lib/format/date";

interface MonthPickerProps {
  /** First day of the selected month. */
  value: Date;
  onChange: (value: Date) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  return (
    <div className="input-month-picker">
      <IconButton
        label="Mois précédent"
        onClick={() => onChange(subMonths(value, 1))}
      >
        <ChevronLeft size={16} aria-hidden />
      </IconButton>
      <span className="input-month-picker__label">
        {formatMonthLabel(value)}
      </span>
      <IconButton
        label="Mois suivant"
        onClick={() => onChange(addMonths(value, 1))}
      >
        <ChevronRight size={16} aria-hidden />
      </IconButton>
    </div>
  );
}
