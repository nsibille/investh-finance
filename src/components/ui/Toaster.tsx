"use client";

import { useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { useUIStore, type Toast, type ToastVariant } from "@/stores/ui";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const AUTO_DISMISS_MS = 4000;

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useUIStore((s) => s.dismissToast);
  const Icon = ICONS[toast.variant];

  useEffect(() => {
    const timer = setTimeout(
      () => dismissToast(toast.id),
      toast.duration ?? AUTO_DISMISS_MS,
    );
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismissToast]);

  return (
    <div className={`toast-${toast.variant}`} role="status">
      <Icon size={18} aria-hidden />
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action?.onClick();
            dismissToast(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className="toast-dismiss"
        aria-label="Fermer"
        onClick={() => dismissToast(toast.id)}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

export type { ToastVariant };
