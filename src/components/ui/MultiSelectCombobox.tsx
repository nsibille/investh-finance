"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, X } from "lucide-react";

export interface MultiSelectOption {
  id: string;
  label: string;
  /** Texte secondaire optionnel (ex. enseigne d'un achat), affiché grisé. */
  hint?: string | null;
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Libellé du trigger quand rien n'est sélectionné. */
  placeholder: string;
  /** Nom singulier de l'entité, pour le compteur (« 2 enseignes »). */
  noun: string;
  nounPlural?: string;
  searchPlaceholder?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Combobox multi-sélection avec recherche insensible casse/accents.
 * Les options cochées sont remontées en tête de liste ; le trigger affiche un
 * compteur. Panneau en portal (position: fixed) aligné sur `input-category-combobox`.
 */
export function MultiSelectCombobox({
  options,
  value,
  onChange,
  placeholder,
  noun,
  nounPlural,
  searchPlaceholder,
  icon,
  disabled,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const searchable = useMemo(
    () =>
      options.map((o) => ({
        ...o,
        haystack: normalize(`${o.label} ${o.hint ?? ""}`),
      })),
    [options],
  );

  // Filtre + tri : sélectionnés d'abord (ordre stable), pour matérialiser le
  // « remontés en haut » demandé, puis alphabétique sur le reste.
  const filtered = useMemo(() => {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    const matches =
      tokens.length === 0
        ? searchable
        : searchable.filter((o) => tokens.every((t) => o.haystack.includes(t)));
    return [...matches].sort((a, b) => {
      const sa = selectedSet.has(a.id) ? 0 : 1;
      const sb = selectedSet.has(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.label.localeCompare(b.label);
    });
  }, [searchable, query, selectedSet]);

  function reposition() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    reposition();
  }, [open]);

  useEffect(() => {
    if (!open || !coords) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, coords]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = panelRef.current?.querySelector(`[data-opt-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function openMenu() {
    if (disabled) return;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setQuery("");
  }

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) toggle(opt.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  const count = value.length;

  return (
    <div className="ms-combobox" ref={wrapRef}>
      <button
        type="button"
        className="ms-combobox__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-active={count > 0 || undefined}
        onClick={() => (open ? close() : openMenu())}
      >
        <span className="ms-combobox__value" data-empty={count === 0 ? "true" : undefined}>
          {icon}
          {count === 0 ? (
            placeholder
          ) : (
            <>
              {count}&nbsp;{count > 1 ? (nounPlural ?? `${noun}s`) : noun}
            </>
          )}
        </span>
        {count > 0 ? (
          <span
            className="ms-combobox__clear"
            role="button"
            tabIndex={-1}
            aria-label="Effacer"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          >
            <X size={14} aria-hidden />
          </span>
        ) : (
          <ChevronDown size={16} aria-hidden className="ms-combobox__chevron" />
        )}
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="ms-combobox__panel"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            role="listbox"
            aria-multiselectable
          >
            <div className="ms-combobox__search">
              <Search size={15} aria-hidden />
              <input
                ref={inputRef}
                className="ms-combobox__input"
                placeholder={searchPlaceholder ?? "Rechercher…"}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
              />
            </div>

            <div className="ms-combobox__list">
              {filtered.length === 0 && (
                <div className="ms-combobox__empty">Aucun résultat</div>
              )}
              {filtered.map((o, i) => {
                const isSelected = selectedSet.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-opt-index={i}
                    data-active={i === activeIndex || undefined}
                    className="ms-combobox__opt"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => toggle(o.id)}
                  >
                    <span className="ms-combobox__check" data-on={isSelected || undefined}>
                      {isSelected && <Check size={12} aria-hidden />}
                    </span>
                    <span className="ms-combobox__opt-label">{o.label}</span>
                    {o.hint && <span className="ms-combobox__opt-hint">{o.hint}</span>}
                  </button>
                );
              })}
            </div>

            {count > 0 && (
              <button
                type="button"
                className="ms-combobox__footer"
                onClick={() => onChange([])}
              >
                Tout désélectionner ({count})
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
