"use client";

import { useUIStore, type ToastOptions } from "@/stores/ui";

export function useToast() {
  const pushToast = useUIStore((s) => s.pushToast);
  return {
    success: (message: string, options?: ToastOptions) =>
      pushToast("success", message, options),
    error: (message: string, options?: ToastOptions) =>
      pushToast("error", message, options),
    warning: (message: string, options?: ToastOptions) =>
      pushToast("warning", message, options),
    info: (message: string, options?: ToastOptions) =>
      pushToast("info", message, options),
  };
}
