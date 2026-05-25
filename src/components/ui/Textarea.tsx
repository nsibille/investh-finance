"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid, className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={
          className ? `input-textarea-md ${className}` : "input-textarea-md"
        }
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  },
);
