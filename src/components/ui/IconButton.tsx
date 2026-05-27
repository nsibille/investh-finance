"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, children, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={className ? `btn-icon-md ${className}` : "btn-icon-md"}
        aria-label={label}
        title={label}
        {...props}
      >
        {children}
      </button>
    );
  },
);
