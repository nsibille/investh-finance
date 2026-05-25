import { create } from "zustand";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface UIState {
  toasts: Toast[];
  pushToast: (variant: ToastVariant, message: string) => void;
  dismissToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  pushToast: (variant, message) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: crypto.randomUUID(), variant, message },
      ].slice(-3),
    })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
