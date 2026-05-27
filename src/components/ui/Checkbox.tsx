"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={className ? `input-checkbox ${className}` : "input-checkbox"}
      {...props}
    />
  );
});

export const Radio = forwardRef<HTMLInputElement, Props>(function Radio(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="radio"
      className={className ? `input-radio ${className}` : "input-radio"}
      {...props}
    />
  );
});

export const Toggle = forwardRef<HTMLInputElement, Props>(function Toggle(
  { className, role = "switch", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      role={role}
      className={className ? `input-toggle ${className}` : "input-toggle"}
      {...props}
    />
  );
});
