"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, Plus } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { createMerchant } from "@/server/actions/merchants";
import type { MerchantOption } from "@/lib/merchants/types";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Sélecteur d'enseigne réutilisable avec création à la volée (comme le sélecteur
 * de catégorie). `onChange` renvoie l'id et l'option choisie (pour hériter la
 * catégorie par défaut de l'enseigne).
 */
export function MerchantSelect({
  value,
  options,
  onChange,
  placeholder = "Aucune enseigne",
  allowCreate = true,
  defaultSubcategoryId = null,
}: {
  value: string | null;
  options: MerchantOption[];
  onChange: (id: string | null, option: MerchantOption | null) => void;
  placeholder?: string;
  allowCreate?: boolean;
  /**
   * Catégorie héritée à la création « à la volée » (ex. catégorie de la
   * transaction depuis laquelle on crée l'enseigne).
   */
  defaultSubcategoryId?: string | null;
}) {
  const toast = useToast();
  const [extra, setExtra] = useState<MerchantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => {
    const seen = new Set(options.map((o) => o.id));
    return [...options, ...extra.filter((o) => !seen.has(o.id))];
  }, [options, extra]);

  const selected = useMemo(() => all.find((o) => o.id === value) ?? null, [all, value]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return q ? all.filter((o) => norm(o.name).includes(q)) : all;
  }, [all, query]);

  const exactExists = all.some((o) => norm(o.name) === norm(query.trim()));

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

  function pick(option: MerchantOption | null) {
    onChange(option?.id ?? null, option);
    setOpen(false);
    setQuery("");
  }

  async function createAndPick() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    const res = await createMerchant({ name, subcategoryId: defaultSubcategoryId });
    setCreating(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      res.subcategoryId ? "Enseigne créée (catégorie héritée)" : "Enseigne créée",
    );
    const option: MerchantOption = { id: res.id, name, subcategoryId: res.subcategoryId };
    setExtra((prev) => (prev.some((m) => m.id === option.id) ? prev : [...prev, option]));
    pick(option);
  }

  return (
    <div className="cat-combobox" ref={wrapRef}>
      <button
        type="button"
        className="cat-combobox__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : setOpen(true))}
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
                placeholder="Rechercher ou créer une enseigne…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="cat-combobox__list">
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className="cat-combobox__opt"
                onClick={() => pick(null)}
              >
                <span className="cat-combobox__dot cat-combobox__dot--none" />
                <span className="cat-combobox__opt-label">{placeholder}</span>
                {!value && <Check size={14} aria-hidden />}
              </button>
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  className="cat-combobox__opt"
                  onClick={() => pick(o)}
                >
                  <span className="cat-combobox__opt-label">{o.name}</span>
                  {o.id === value && <Check size={14} aria-hidden />}
                </button>
              ))}
              {allowCreate && query.trim() && !exactExists && (
                <button
                  type="button"
                  className="cat-combobox__add"
                  disabled={creating}
                  onClick={createAndPick}
                >
                  <Plus size={15} aria-hidden />
                  Créer «&nbsp;{query.trim()}&nbsp;»
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
