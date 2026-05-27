import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  help?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  help,
  children,
}: FormFieldProps) {
  return (
    <div className="form-field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {help && !error && <FormHelp>{help}</FormHelp>}
      {error && <FormError>{error}</FormError>}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <span className="form-error-msg" role="alert">
      <AlertCircle size={12} aria-hidden />
      {children}
    </span>
  );
}

export function FormHelp({ children }: { children: ReactNode }) {
  return <span className="form-help-text">{children}</span>;
}
