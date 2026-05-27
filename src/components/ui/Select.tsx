"use client";

import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ invalid, className, children, ...props }, ref) {
    return (
      <span className="input-select-wrap">
        <select
          ref={ref}
          className={
            className ? `input-select-md ${className}` : "input-select-md"
          }
          aria-invalid={invalid || undefined}
          {...props}
        >
          {children}
        </select>
        <span className="input-select-wrap__chevron">
          <ChevronDown size={16} aria-hidden />
        </span>
      </span>
    );
  },
);
