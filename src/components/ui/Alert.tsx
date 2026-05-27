import type { ReactNode } from "react";
import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

type Variant = "info" | "warning" | "danger" | "success";

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
  success: CheckCircle2,
} as const;

export function Alert({
  variant,
  children,
}: {
  variant: Variant;
  children: ReactNode;
}) {
  const Icon = ICONS[variant];
  return (
    <div className={`alert-${variant}`} role="alert">
      <Icon size={18} aria-hidden style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}
