"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import type { SubcategoryOption } from "@/lib/categories/types";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface Item {
  id: string | null;
  label: string;
}

/**
 * Éditeur de catégorie inline pour l'aperçu d'import : au clic, saisie clavier
 * immédiate + autocomplétion. Entrée valide la catégorie surlignée ; Tab valide
 * et passe à la catégorie de la ligne suivante ; Échap/clic dehors annule.
 */
export function ImportCategoryEditor({
  options,
  onSelect,
  onTabNext,
  onClose,
}: {
  options: SubcategoryOption[];
  value: string | null;
  onSelect: (id: string | null) => void;
  onTabNext: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    const tokens = q.split(/\s+/).filter(Boolean);
    return options.filter((o) => {
      const hay = normalize(`${o.typeName} ${o.categoryName} ${o.subName ?? ""}`);
      return tokens.every((t) => hay.includes(t));
    });
  }, [options, query]);

  // « Non catégorisée » proposé en tête tant qu'on n'a pas commencé à taper.
  const items: Item[] = useMemo(() => {
    const base: Item[] = filtered.map((o) => ({ id: o.id, label: o.label }));
    return query.trim() ? base : [{ id: null, label: "Non catégorisée" }, ...base];
  }, [filtered, query]);

  function reposition() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) });
  }

  useEffect(() => {
    reposition();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const on = () => reposition();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, []);

  // Fermer au clic en dehors (input + panneau).
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Garder l'option active visible.
  useEffect(() => {
    if (active < 0) return;
    panelRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function commitActive() {
    if (active >= 0 && items[active]) onSelect(items[active].id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitActive();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitActive();
      onTabNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div ref={wrapRef} className="import-cat-ac">
      <Search size={14} aria-hidden style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={query}
        placeholder="Catégorie…"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(e.target.value.trim() ? 0 : -1);
        }}
        onKeyDown={onKeyDown}
      />
      {coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="cat-combobox__panel"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            <div className="cat-combobox__list">
              {items.length === 0 && <div className="cat-combobox__empty">Aucune catégorie</div>}
              {items.slice(0, 100).map((it, i) => (
                <button
                  key={`${it.id ?? "none"}-${i}`}
                  type="button"
                  data-idx={i}
                  data-active={i === active || undefined}
                  className="cat-combobox__opt"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(it.id);
                    onClose();
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span className="cat-combobox__opt-label">
                    {it.id === null ? <em>{it.label}</em> : it.label}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
