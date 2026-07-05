"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Plus } from "lucide-react";
import type { SubcategoryOption } from "@/lib/categories/types";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CREATE = "__create__";

interface Item {
  id: string | null;
  label: string;
}

/**
 * Éditeur de catégorie inline (aperçu d'import + liste de transactions) : au
 * clic, saisie clavier immédiate + autocomplétion. Entrée valide la catégorie
 * surlignée ; Tab valide et passe à la catégorie de la ligne suivante ;
 * Échap/clic dehors annule.
 */
export function CategoryInlineEditor({
  options,
  onSelect,
  onCreate,
  onTabNext,
  onClose,
}: {
  options: SubcategoryOption[];
  value: string | null;
  onSelect: (id: string | null) => void;
  /** Créer une catégorie à la volée avec ce nom. */
  onCreate: (name: string) => void;
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

  // « Non catégorisée » en tête tant qu'on n'a pas tapé ; « Créer … » en pied
  // dès qu'on tape (création à la volée).
  const items: Item[] = useMemo(() => {
    const base: Item[] = filtered.map((o) => ({ id: o.id, label: o.label }));
    const q = query.trim();
    if (!q) return [{ id: null, label: "Non catégorisée" }, ...base];
    return [...base, { id: CREATE, label: q }];
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

  function choose(item: Item) {
    if (item.id === CREATE) onCreate(item.label);
    else onSelect(item.id);
  }

  function commitActive() {
    if (active >= 0 && items[active]) choose(items[active]);
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
                    choose(it);
                    onClose();
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  {it.id === CREATE ? (
                    <>
                      <Plus size={14} aria-hidden style={{ flexShrink: 0 }} />
                      <span className="cat-combobox__opt-label">
                        Créer «&nbsp;{it.label}&nbsp;»
                      </span>
                    </>
                  ) : (
                    <span className="cat-combobox__opt-label">
                      {it.id === null ? <em>{it.label}</em> : it.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
