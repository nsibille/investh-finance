"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

/**
 * Annotation inline d'une transaction : une icône « note » (pleine si une note
 * existe) ouvre un petit éditeur en popover, sans quitter la liste. Enregistrer
 * remonte la valeur au parent (qui persiste selon le contexte : store d'import
 * ou server action pour une transaction existante).
 */
export function NoteCell({
  note,
  onSave,
}: {
  note: string | null;
  onSave: (value: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  // Aperçu au survol : lecture instantanée du commentaire sans ouvrir l'éditeur.
  const [hoverCoords, setHoverCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasNote = Boolean(note && note.trim());

  function reposition() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Panneau ancré sous le bouton, aligné à droite (jamais hors écran à droite).
    const width = 280;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setCoords({ top: r.bottom + 4, left });
  }

  function openPopover() {
    setValue(note ?? "");
    setHoverCoords(null);
    setOpen(true);
  }

  function showHover() {
    if (!hasNote || open) return;
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 260;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setHoverCoords({ top: r.bottom + 4, left });
  }

  useEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const on = () => reposition();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      await onSave(value.trim());
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="note-cell__btn"
        data-filled={hasNote || undefined}
        aria-label={hasNote ? "Lire ou modifier la note" : "Ajouter une note"}
        onClick={() => (open ? setOpen(false) : openPopover())}
        onMouseEnter={showHover}
        onMouseLeave={() => setHoverCoords(null)}
        onFocus={showHover}
        onBlur={() => setHoverCoords(null)}
      >
        <StickyNote size={15} aria-hidden />
      </button>

      {hoverCoords &&
        !open &&
        hasNote &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="note-tooltip" style={{ top: hoverCoords.top, left: hoverCoords.left }}>
            {note}
          </div>,
          document.body,
        )}

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="note-popover"
            style={{ top: coords.top, left: coords.left }}
          >
            <Textarea
              ref={textareaRef}
              value={value}
              rows={4}
              placeholder="Ajoute une note…"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
            />
            <div className="note-popover__actions">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button size="sm" loading={saving} onClick={save}>
                Enregistrer
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
