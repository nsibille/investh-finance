import { create } from "zustand";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** Plusieurs actions (rendues côte à côte). */
  actions?: ToastAction[];
  /** Auto-dismiss delay in ms. Defaults to 4000. */
  duration?: number;
}

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  action?: ToastAction;
  actions?: ToastAction[];
  duration?: number;
}

interface UIState {
  toasts: Toast[];
  pushToast: (
    variant: ToastVariant,
    message: string,
    options?: ToastOptions,
  ) => void;
  dismissToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  pushToast: (variant, message, options) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: crypto.randomUUID(),
          variant,
          message,
          action: options?.action,
          actions: options?.actions,
          duration: options?.duration,
        },
      ].slice(-3),
    })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
