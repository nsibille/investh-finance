"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, Plus } from "lucide-react";
import type { RecurringOption } from "@/lib/recurring/queries";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Sélecteur de récurrente réutilisable avec création à la volée. La création
 * est déléguée au parent (`onCreate`) car elle a besoin du contexte de la
 * transaction (libellé, montant).
 */
export function RecurringSelect({
  value,
  options,
  onChange,
  onCreate,
  placeholder = "Associer à une récurrente…",
}: {
  value: string | null;
  options: RecurringOption[];
  onChange: (id: string | null) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return q ? options.filter((o) => norm(o.name).includes(q)) : options;
  }, [options, query]);
  const exactExists = options.some((o) => norm(o.name) === norm(query.trim()));

  function reposition() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function create() {
    const name = query.trim();
    if (!name || !onCreate) return;
    onCreate(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="cat-combobox" ref={wrapRef}>
      <button
        type="button"
        className="cat-combobox__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="cat-combobox__value" data-empty={selected ? undefined : "true"}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={16} aria-hidden className="cat-combobox__chevron" />
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="cat-combobox__panel"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            role="listbox"
          >
            <div className="cat-combobox__search">
              <Search size={15} aria-hidden />
              <input
                ref={inputRef}
                className="cat-combobox__input"
                placeholder="Rechercher ou créer une récurrente…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="cat-combobox__list">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  className="cat-combobox__opt"
                  onClick={() => pick(o.id)}
                >
                  <span className="cat-combobox__opt-label">{o.name}</span>
                  {o.id === value && <Check size={14} aria-hidden />}
                </button>
              ))}
              {onCreate && query.trim() && !exactExists && (
                <button type="button" className="cat-combobox__add" onClick={create}>
                  <Plus size={15} aria-hidden />
                  Créer «&nbsp;{query.trim()}&nbsp;»
                </button>
              )}
              {filtered.length === 0 && !query.trim() && (
                <div className="cat-combobox__empty">Aucune récurrente</div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
