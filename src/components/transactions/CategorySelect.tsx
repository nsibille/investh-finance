"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, Plus, ArrowLeft } from "lucide-react";
import type { SubcategoryOption } from "@/lib/categories/types";
import { useToast } from "@/hooks/useToast";
import { ACCOUNT_COLORS } from "@/lib/accounts/constants";
import {
  getCategoryParents,
  createSubcategory,
  createCategoryWithDefaultSub,
  type CategoryParents,
} from "@/server/actions/categories";

interface CategorySelectProps {
  value: string | null;
  options: SubcategoryOption[];
  onChange: (subcategoryId: string | null) => void;
  disabled?: boolean;
  /** Texte du trigger vide et de la ligne « effacer ». Défaut : « Non catégorisée ». */
  placeholder?: string;
  invalid?: boolean;
  /** Active la création inline d'une catégorie / sous-catégorie depuis le menu. */
  allowCreate?: boolean;
  /**
   * Notifie le parent d'une catégorie créée à la volée (pour l'ajouter à ses
   * propres options, ex. libellés d'une table). Appelé avant `onChange`.
   */
  onCreated?: (option: SubcategoryOption) => void;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

type RenderItem =
  | { kind: "type"; key: string; name: string }
  | { kind: "category"; key: string; name: string; color: string | null }
  | {
      kind: "option";
      key: string;
      id: string | null;
      label: string;
      indent: boolean;
      dot: string | null;
      /** Ligne représentant la catégorie parente elle-même (défaut « — »). */
      isCategory?: boolean;
    };

export function CategorySelect({
  value,
  options,
  onChange,
  disabled,
  placeholder = "Non catégorisée",
  invalid,
  allowCreate,
  onCreated,
}: CategorySelectProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // Catégories créées à la volée : fusionnées localement pour être
  // immédiatement sélectionnables sans dépendre d'un rafraîchissement serveur
  // (qui ne remonte pas toujours à temps et pouvait « perdre » la sélection).
  const [createdOptions, setCreatedOptions] = useState<SubcategoryOption[]>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Inline creation ("create" replaces the list inside the same panel).
  const [mode, setMode] = useState<"list" | "create">("list");
  const [parents, setParents] = useState<CategoryParents | null>(null);
  const [loadingParents, setLoadingParents] = useState(false);
  const [createKind, setCreateKind] = useState<"subcategory" | "category">(
    "subcategory",
  );
  const [parentId, setParentId] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Options affichées = props + créations locales (dédoublonnées par id).
  const allOptions = useMemo(() => {
    if (createdOptions.length === 0) return options;
    const ids = new Set(options.map((o) => o.id));
    return [...options, ...createdOptions.filter((o) => !ids.has(o.id))];
  }, [options, createdOptions]);

  const selected = useMemo(
    () => allOptions.find((o) => o.id === value) ?? null,
    [allOptions, value],
  );

  const searchable = useMemo(
    () =>
      allOptions.map((o) => ({
        ...o,
        haystack: normalize(`${o.typeName} ${o.categoryName} ${o.subName ?? ""}`),
      })),
    [allOptions],
  );

  const filtered = useMemo(() => {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return searchable;
    return searchable.filter((o) =>
      tokens.every((t) => o.haystack.includes(t)),
    );
  }, [searchable, query]);

  // Build the rendered tree (type → category → leaves) plus the "clear" row.
  const { items, selectableIndexes } = useMemo(() => {
    const out: RenderItem[] = [];
    // The "clear" row is hidden while searching so Enter selects the first match.
    if (query.trim() === "") {
      out.push({
        kind: "option",
        key: "__none__",
        id: null,
        label: placeholder,
        indent: false,
        dot: null,
      });
    }

    let lastType: string | null = null;
    let lastCat: string | null = null;

    // Group leaves by category so a category with only the "—" placeholder
    // becomes a selectable row, while real subcategories nest under it.
    const byCat = new Map<
      string,
      { typeName: string; categoryName: string; color: string | null; subs: typeof filtered }
    >();
    for (const o of filtered) {
      const key = `${o.typeName} ${o.categoryName}`;
      const group = byCat.get(key);
      if (group) group.subs.push(o);
      else
        byCat.set(key, {
          typeName: o.typeName,
          categoryName: o.categoryName,
          color: o.categoryColor,
          subs: [o],
        });
    }

    for (const [, group] of byCat) {
      if (group.typeName !== lastType) {
        out.push({ kind: "type", key: `t-${group.typeName}`, name: group.typeName });
        lastType = group.typeName;
        lastCat = null;
      }

      // Défaut « — » (subName null) = la catégorie parente elle-même ;
      // sous-catégories nommées = les enfants sélectionnables.
      const defaultOpt = group.subs.find((s) => s.subName === null);
      const realSubs = group.subs.filter((s) => s.subName !== null);

      if (realSubs.length === 0 && defaultOpt) {
        // Catégorie sans sous-catégorie nommée : une seule ligne = la catégorie.
        out.push({
          kind: "option",
          key: defaultOpt.id,
          id: defaultOpt.id,
          label: group.categoryName,
          indent: false,
          dot: group.color,
        });
      } else {
        // En-tête de catégorie : cliquable (= sélectionne la catégorie parente)
        // dès qu'un défaut « — » existe ; sinon libellé non sélectionnable.
        if (defaultOpt) {
          out.push({
            kind: "option",
            key: `cat-${defaultOpt.id}`,
            id: defaultOpt.id,
            label: group.categoryName,
            indent: false,
            dot: group.color,
            isCategory: true,
          });
        } else {
          const catKey = `c-${group.typeName}-${group.categoryName}`;
          if (catKey !== lastCat) {
            out.push({
              kind: "category",
              key: catKey,
              name: group.categoryName,
              color: group.color,
            });
            lastCat = catKey;
          }
        }
        for (const sub of realSubs) {
          out.push({
            kind: "option",
            key: sub.id,
            id: sub.id,
            label: sub.subName ?? "Général",
            indent: true,
            dot: group.color,
          });
        }
      }
    }

    const idx: number[] = [];
    out.forEach((it, i) => {
      if (it.kind === "option") idx.push(i);
    });
    return { items: out, selectableIndexes: idx };
  }, [filtered, query, placeholder]);

  // Parent categories grouped by type, for the "create subcategory" <select>.
  const parentCatGroups = useMemo(() => {
    const groups = new Map<string, CategoryParents["categories"]>();
    for (const c of parents?.categories ?? []) {
      const list = groups.get(c.typeName) ?? [];
      list.push(c);
      groups.set(c.typeName, list);
    }
    return [...groups.entries()];
  }, [parents]);

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

  // Focus the search input after the panel mounts. We wait for `coords` so the
  // portal has actually rendered (the input is null on the first commit), and
  // defer past the trigger's click focus via rAF.
  useEffect(() => {
    if (!open || !coords || mode !== "list") return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, coords, mode]);

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

  // Scroll the active option into view as it changes.
  useEffect(() => {
    if (!open) return;
    const flat = selectableIndexes[activeIndex];
    if (flat == null) return;
    const node = panelRef.current?.querySelector(
      `[data-opt-index="${flat}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, selectableIndexes]);

  function openMenu() {
    if (disabled) return;
    setQuery("");
    setActiveIndex(0);
    setMode("list");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
    setMode("list");
    setCreateError(null);
  }

  async function enterCreate(prefill: string) {
    setCreateError(null);
    setNewName(prefill);
    setNewColor("");
    setMode("create");
    let p = parents;
    if (!p) {
      setLoadingParents(true);
      try {
        p = await getCategoryParents();
        setParents(p);
      } finally {
        setLoadingParents(false);
      }
    }
    if (p) {
      const kind = p.categories.length > 0 ? "subcategory" : "category";
      setCreateKind(kind);
      setParentId(
        kind === "subcategory"
          ? (p.categories[0]?.id ?? "")
          : (p.types[0]?.id ?? ""),
      );
    }
  }

  function switchKind(kind: "subcategory" | "category") {
    setCreateKind(kind);
    if (!parents) return;
    setParentId(
      kind === "subcategory"
        ? (parents.categories[0]?.id ?? "")
        : (parents.types[0]?.id ?? ""),
    );
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return setCreateError("Donne un nom.");
    if (!parentId)
      return setCreateError(
        createKind === "subcategory"
          ? "Choisis une catégorie parente."
          : "Choisis un type parent.",
      );
    setCreating(true);
    setCreateError(null);
    const res =
      createKind === "subcategory"
        ? await createSubcategory({ category_id: parentId, name })
        : await createCategoryWithDefaultSub({
            category_type_id: parentId,
            name,
            color: newColor,
          });
    setCreating(false);
    if (!res.ok) return setCreateError(res.error);
    toast.success(
      createKind === "subcategory" ? "Sous-catégorie créée" : "Catégorie créée",
    );

    // Construit l'option correspondante pour l'exposer immédiatement (sélection
    // persistée sur l'objet hôte sans attendre un rafraîchissement serveur).
    let newOption: SubcategoryOption | null = null;
    if (createKind === "subcategory") {
      const parentCat = parents?.categories.find((c) => c.id === parentId);
      if (parentCat) {
        newOption = {
          id: res.id,
          typeName: parentCat.typeName,
          categoryName: parentCat.name,
          categoryColor: parentCat.color,
          subName: name,
          label: `${parentCat.typeName} / ${parentCat.name} / ${name}`,
        };
      }
    } else {
      const parentType = parents?.types.find((t) => t.id === parentId);
      if (parentType) {
        newOption = {
          id: res.id,
          typeName: parentType.name,
          categoryName: name,
          categoryColor: newColor || null,
          subName: null,
          label: `${parentType.name} / ${name}`,
        };
      }
    }
    if (newOption) {
      setCreatedOptions((prev) => [...prev, newOption!]);
      onCreated?.(newOption);
    }
    onChange(res.id);
    close();
  }

  function pick(id: string | null) {
    onChange(id);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, selectableIndexes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const flat = selectableIndexes[activeIndex];
      const item = flat != null ? items[flat] : null;
      if (item && item.kind === "option") pick(item.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <div className="cat-combobox" ref={wrapRef}>
      <button
        type="button"
        className="cat-combobox__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-invalid={invalid || undefined}
        onClick={() => (open ? close() : openMenu())}
      >
        <span className="cat-combobox__value" data-empty={selected ? undefined : "true"}>
          {selected ? (
            <>
              <span
                className="cat-combobox__dot"
                style={{ background: selected.categoryColor ?? undefined }}
              />
              {selected.label}
            </>
          ) : (
            placeholder
          )}
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
            role={mode === "list" ? "listbox" : undefined}
          >
            {mode === "list" ? (
              <>
                <div className="cat-combobox__search">
                  <Search size={15} aria-hidden />
                  <input
                    ref={inputRef}
                    className="cat-combobox__input"
                    placeholder="Rechercher une catégorie…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={onKeyDown}
                  />
                </div>

                <div className="cat-combobox__list">
                  {selectableIndexes.length === 0 &&
                    (allowCreate && query.trim() ? (
                      <button
                        type="button"
                        className="cat-combobox__add"
                        onClick={() => enterCreate(query.trim())}
                      >
                        <Plus size={15} aria-hidden />
                        Créer «&nbsp;{query.trim()}&nbsp;»
                      </button>
                    ) : (
                      <div className="cat-combobox__empty">Aucune catégorie</div>
                    ))}
                  {items.map((it, i) => {
                    if (it.kind === "type") {
                      return (
                        <div key={it.key} className="cat-combobox__type">
                          {it.name}
                        </div>
                      );
                    }
                    if (it.kind === "category") {
                      return (
                        <div key={it.key} className="cat-combobox__cat">
                          <span
                            className="cat-combobox__dot"
                            style={{ background: it.color ?? undefined }}
                          />
                          {it.name}
                        </div>
                      );
                    }
                    const active = selectableIndexes[activeIndex] === i;
                    const isSelected = it.id === value;
                    return (
                      <button
                        key={it.key}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-opt-index={i}
                        data-active={active || undefined}
                        data-indent={it.indent || undefined}
                        data-cat={it.isCategory || undefined}
                        className="cat-combobox__opt"
                        onMouseEnter={() =>
                          setActiveIndex(selectableIndexes.indexOf(i))
                        }
                        onClick={() => pick(it.id)}
                      >
                        {it.dot !== null ? (
                          <span
                            className="cat-combobox__dot"
                            style={{ background: it.dot ?? undefined }}
                          />
                        ) : (
                          <span className="cat-combobox__dot cat-combobox__dot--none" />
                        )}
                        <span className="cat-combobox__opt-label">{it.label}</span>
                        {isSelected && <Check size={14} aria-hidden />}
                      </button>
                    );
                  })}
                </div>

                {allowCreate && (
                  <button
                    type="button"
                    className="cat-combobox__add cat-combobox__add--footer"
                    onClick={() => enterCreate(query.trim())}
                  >
                    <Plus size={15} aria-hidden />
                    Créer une catégorie
                  </button>
                )}
              </>
            ) : (
              <div className="cat-combobox__create">
                <button
                  type="button"
                  className="cat-combobox__back"
                  onClick={() => setMode("list")}
                >
                  <ArrowLeft size={15} aria-hidden />
                  Retour
                </button>
                {loadingParents ? (
                  <div className="cat-combobox__empty">Chargement…</div>
                ) : (
                  <form className="cat-combobox__create-body" onSubmit={submitCreate}>
                    {createError && (
                      <div className="cat-combobox__create-error">{createError}</div>
                    )}
                    <div className="cat-combobox__seg">
                      <button
                        type="button"
                        data-active={createKind === "subcategory" || undefined}
                        onClick={() => switchKind("subcategory")}
                      >
                        Sous-catégorie
                      </button>
                      <button
                        type="button"
                        data-active={createKind === "category" || undefined}
                        onClick={() => switchKind("category")}
                      >
                        Catégorie
                      </button>
                    </div>

                    <label className="cat-combobox__field">
                      <span>
                        {createKind === "subcategory"
                          ? "Dans la catégorie"
                          : "Dans le type"}
                      </span>
                      <select
                        className="cat-combobox__select"
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                      >
                        {createKind === "subcategory"
                          ? parentCatGroups.map(([typeName, cats]) => (
                              <optgroup key={typeName} label={typeName}>
                                {cats.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))
                          : parents?.types.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                      </select>
                    </label>

                    <label className="cat-combobox__field">
                      <span>Nom</span>
                      <input
                        autoFocus
                        className="cat-combobox__create-input"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={
                          createKind === "subcategory" ? "Intérêts" : "Courses"
                        }
                      />
                    </label>

                    {createKind === "category" && (
                      <div className="cat-combobox__field">
                        <span>Couleur</span>
                        <div className="cat-combobox__colors">
                          {ACCOUNT_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              aria-label={`Couleur ${c}`}
                              data-active={newColor === c || undefined}
                              onClick={() => setNewColor(c)}
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="cat-combobox__create-actions">
                      <button
                        type="button"
                        className="cat-combobox__create-cancel"
                        onClick={() => setMode("list")}
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="cat-combobox__create-submit"
                        disabled={creating}
                      >
                        {creating ? "Création…" : "Créer"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
