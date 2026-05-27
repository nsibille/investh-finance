"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={className ? `input-text-md ${className}` : "input-text-md"}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const SearchInput = forwardRef<HTMLInputElement, InputProps>(
  function SearchInput({ invalid, placeholder = "Rechercher…", ...props }, ref) {
    return (
      <span className="input-affix">
        <span className="input-affix__icon" data-side="leading">
          <Search size={16} aria-hidden />
        </span>
        <input
          ref={ref}
          type="search"
          className="input-search-md"
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          {...props}
        />
      </span>
    );
  },
);

export const CurrencyInput = forwardRef<HTMLInputElement, InputProps>(
  function CurrencyInput({ invalid, ...props }, ref) {
    return (
      <span className="input-affix">
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          className="input-currency-md"
          aria-invalid={invalid || undefined}
          {...props}
        />
        <span className="input-affix__icon" data-side="trailing">
          €
        </span>
      </span>
    );
  },
);

export const DateInput = forwardRef<HTMLInputElement, InputProps>(
  function DateInput({ invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="date"
        className="input-date-md"
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);
