"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const CLASS_MAP: Record<string, string> = {
  "primary-sm": "btn-primary-sm",
  "primary-md": "btn-primary-md",
  "primary-lg": "btn-primary-lg",
  "secondary-md": "btn-secondary-md",
  "ghost-sm": "btn-ghost-sm",
  "ghost-md": "btn-ghost-md",
  "danger-md": "btn-danger-md",
};

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) {
    const key = `${variant}-${size}`;
    const slug = CLASS_MAP[key] ?? CLASS_MAP[`${variant}-md`] ?? "btn-primary-md";
    return (
      <button
        ref={ref}
        className={className ? `${slug} ${className}` : slug}
        data-loading={loading || undefined}
        disabled={disabled || loading}
        {...props}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  },
);
