"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra slug for variants, e.g. "modal-bank-selector". */
  variantClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variantClass,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden />
      <div
        className={
          variantClass ? `modal-surface ${variantClass}` : "modal-surface"
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div className="modal-surface__header">
            <h2 className="modal-surface__title">{title}</h2>
            <IconButton label="Fermer" onClick={onClose}>
              <X size={16} aria-hidden />
            </IconButton>
          </div>
        )}
        <div className="modal-surface__body">{children}</div>
        {footer && <div className="modal-surface__footer">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
