"use client";

import { useUIStore } from "@/stores/ui";

export function useToast() {
  const pushToast = useUIStore((s) => s.pushToast);
  return {
    success: (message: string) => pushToast("success", message),
    error: (message: string) => pushToast("error", message),
    warning: (message: string) => pushToast("warning", message),
    info: (message: string) => pushToast("info", message),
  };
}
