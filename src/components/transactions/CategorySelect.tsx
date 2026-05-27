"use client";

import { Select } from "@/components/ui/Select";
import type { SubcategoryOption } from "@/lib/categories/types";

interface CategorySelectProps {
  value: string | null;
  options: SubcategoryOption[];
  onChange: (subcategoryId: string | null) => void;
  disabled?: boolean;
}

export function CategorySelect({
  value,
  options,
  onChange,
  disabled,
}: CategorySelectProps) {
  return (
    <Select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Non catégorisée</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
