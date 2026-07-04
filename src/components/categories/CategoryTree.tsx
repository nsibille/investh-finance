"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  GripVertical,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Dot } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { CategoryForm } from "./CategoryForm";
import { SubcategoryForm } from "./SubcategoryForm";
import {
  setCategoryArchived,
  setSubcategoryArchived,
  reorderCategories,
  reorderSubcategories,
} from "@/server/actions/categories";
import type {
  CategoryTypeNode,
  CategoryNode,
  Subcategory,
} from "@/lib/categories/types";

type CategoryModal =
  | { mode: "create"; typeId: string }
  | { mode: "edit"; typeId: string; category: CategoryNode }
  | null;

type SubModal =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; categoryId: string; sub: Subcategory }
  | null;

export function CategoryTree({ tree }: { tree: CategoryTypeNode[] }) {
  const router = useRouter();
  const toast = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [categoryModal, setCategoryModal] = useState<CategoryModal>(null);
  const [subModal, setSubModal] = useState<SubModal>(null);

  const [localTree, setLocalTree] = useState(tree);
  const [prevTree, setPrevTree] = useState(tree);
  if (tree !== prevTree) {
    setPrevTree(tree);
    setLocalTree(tree);
  }

  // Drag & drop : réordonnancement des catégories (par type) et des
  // sous-catégories (par catégorie). `over` sert d'indicateur visuel.
  const [dragCat, setDragCat] = useState<{ typeId: string; id: string } | null>(null);
  const [overCat, setOverCat] = useState<string | null>(null);
  const [dragSub, setDragSub] = useState<{ categoryId: string; id: string } | null>(null);
  const [overSub, setOverSub] = useState<string | null>(null);

  function moveCategory(typeId: string, dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const type = localTree.find((t) => t.id === typeId);
    if (!type) return;
    const cats = [...type.categories];
    const from = cats.findIndex((c) => c.id === dragId);
    const to = cats.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = cats.splice(from, 1);
    cats.splice(to, 0, moved);
    setLocalTree(localTree.map((t) => (t.id === typeId ? { ...t, categories: cats } : t)));
    reorderCategories(cats.map((c) => c.id)).then((res) => {
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  function moveSubcategory(categoryId: string, dragId: string, targetId: string) {
    if (dragId === targetId) return;
    let changed: string[] | null = null;
    const next = localTree.map((t) => ({
      ...t,
      categories: t.categories.map((c) => {
        if (c.id !== categoryId) return c;
        const subs = [...c.subcategories];
        const from = subs.findIndex((s) => s.id === dragId);
        const to = subs.findIndex((s) => s.id === targetId);
        if (from < 0 || to < 0) return c;
        const [moved] = subs.splice(from, 1);
        subs.splice(to, 0, moved);
        changed = subs.map((s) => s.id);
        return { ...c, subcategories: subs };
      }),
    }));
    if (!changed) return;
    setLocalTree(next);
    reorderSubcategories(changed).then((res) => {
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function archiveCategory(cat: CategoryNode) {
    const snapshot = localTree;
    const next = !cat.is_archived;
    const res = await runOptimistic({
      apply: () =>
        setLocalTree(
          snapshot.map((t) => ({
            ...t,
            categories: t.categories.map((c) =>
              c.id === cat.id ? { ...c, is_archived: next } : c,
            ),
          })),
        ),
      rollback: () => setLocalTree(snapshot),
      run: () => setCategoryArchived(cat.id, next),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success(cat.is_archived ? "Catégorie désarchivée" : "Catégorie archivée");
      router.refresh();
    }
  }

  async function archiveSub(sub: Subcategory) {
    const snapshot = localTree;
    const next = !sub.is_archived;
    const res = await runOptimistic({
      apply: () =>
        setLocalTree(
          snapshot.map((t) => ({
            ...t,
            categories: t.categories.map((c) => ({
              ...c,
              subcategories: c.subcategories.map((s) =>
                s.id === sub.id ? { ...s, is_archived: next } : s,
              ),
            })),
          })),
        ),
      rollback: () => setLocalTree(snapshot),
      run: () => setSubcategoryArchived(sub.id, next),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success(sub.is_archived ? "Sous-catégorie désarchivée" : "Sous-catégorie archivée");
      router.refresh();
    }
  }

  return (
    <>
      <div style={{ marginBottom: "var(--space-5)" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          <Checkbox
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Afficher les éléments archivés
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {localTree.map((type) => {
          const cats = type.categories.filter(
            (c) => showArchived || !c.is_archived,
          );
          return (
            <Card key={type.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-4)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Dot color={type.color} />
                  <strong style={{ fontSize: "var(--text-base)" }}>{type.name}</strong>
                  {type.is_income && (
                    <span className="badge-status-validated">Revenu</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Plus size={14} />}
                  onClick={() => setCategoryModal({ mode: "create", typeId: type.id })}
                >
                  Catégorie
                </Button>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {cats.length === 0 && (
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                    Aucune catégorie.
                  </span>
                )}
                {cats.map((cat) => {
                  const isOpen = expanded.has(cat.id);
                  const subs = cat.subcategories.filter(
                    (s) => showArchived || !s.is_archived,
                  );
                  return (
                    <div key={cat.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", cat.id);
                          setDragCat({ typeId: type.id, id: cat.id });
                        }}
                        onDragEnd={() => {
                          setDragCat(null);
                          setOverCat(null);
                        }}
                        onDragOver={(e) => {
                          if (dragCat?.typeId === type.id && dragCat.id !== cat.id) {
                            e.preventDefault();
                            setOverCat(cat.id);
                          }
                        }}
                        onDragLeave={() => setOverCat((o) => (o === cat.id ? null : o))}
                        onDrop={() => {
                          if (dragCat?.typeId === type.id) moveCategory(type.id, dragCat.id, cat.id);
                          setDragCat(null);
                          setOverCat(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                          padding: "var(--space-2) 0",
                          opacity: cat.is_archived ? 0.55 : dragCat?.id === cat.id ? 0.4 : 1,
                          boxShadow:
                            overCat === cat.id ? "inset 0 2px 0 0 var(--color-brand-primary)" : "none",
                        }}
                      >
                        <span
                          aria-hidden
                          title="Glisser pour réordonner"
                          style={{ display: "inline-flex", color: "var(--color-text-muted)", cursor: "grab" }}
                        >
                          <GripVertical size={14} />
                        </span>
                        <IconButton
                          label={isOpen ? "Replier" : "Déplier"}
                          onClick={() => toggle(cat.id)}
                        >
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </IconButton>
                        <Dot color={cat.color ?? type.color} />
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--fw-medium)", flex: 1 }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                          {subs.length} sous-cat.
                        </span>
                        <IconButton
                          label="Ajouter une sous-catégorie"
                          onClick={() => setSubModal({ mode: "create", categoryId: cat.id })}
                        >
                          <Plus size={16} />
                        </IconButton>
                        <IconButton
                          label="Modifier la catégorie"
                          onClick={() =>
                            setCategoryModal({ mode: "edit", typeId: type.id, category: cat })
                          }
                        >
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton
                          label={cat.is_archived ? "Désarchiver" : "Archiver"}
                          onClick={() => archiveCategory(cat)}
                        >
                          {cat.is_archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                        </IconButton>
                      </div>

                      {isOpen && (
                        <div style={{ paddingLeft: "var(--space-10)", paddingBottom: "var(--space-2)" }}>
                          {subs.map((sub) => (
                            <div
                              key={sub.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", sub.id);
                                setDragSub({ categoryId: cat.id, id: sub.id });
                              }}
                              onDragEnd={() => {
                                setDragSub(null);
                                setOverSub(null);
                              }}
                              onDragOver={(e) => {
                                if (dragSub?.categoryId === cat.id && dragSub.id !== sub.id) {
                                  e.preventDefault();
                                  setOverSub(sub.id);
                                }
                              }}
                              onDragLeave={() => setOverSub((o) => (o === sub.id ? null : o))}
                              onDrop={() => {
                                if (dragSub?.categoryId === cat.id)
                                  moveSubcategory(cat.id, dragSub.id, sub.id);
                                setDragSub(null);
                                setOverSub(null);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-2)",
                                padding: "var(--space-1) 0",
                                opacity: sub.is_archived ? 0.55 : dragSub?.id === sub.id ? 0.4 : 1,
                                boxShadow:
                                  overSub === sub.id ? "inset 0 2px 0 0 var(--color-brand-primary)" : "none",
                              }}
                            >
                              <span
                                aria-hidden
                                title="Glisser pour réordonner"
                                style={{ display: "inline-flex", color: "var(--color-text-muted)", cursor: "grab" }}
                              >
                                <GripVertical size={13} />
                              </span>
                              <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                                {sub.name === "—" ? "(défaut)" : sub.name}
                              </span>
                              <IconButton
                                label="Modifier la sous-catégorie"
                                onClick={() =>
                                  setSubModal({ mode: "edit", categoryId: cat.id, sub })
                                }
                              >
                                <Pencil size={14} />
                              </IconButton>
                              <IconButton
                                label={sub.is_archived ? "Désarchiver" : "Archiver"}
                                onClick={() => archiveSub(sub)}
                              >
                                {sub.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                              </IconButton>
                            </div>
                          ))}
                          {subs.length === 0 && (
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                              Aucune sous-catégorie.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={categoryModal !== null}
        onClose={() => setCategoryModal(null)}
        title={categoryModal?.mode === "edit" ? "Modifier la catégorie" : "Nouvelle catégorie"}
      >
        {categoryModal && (
          <CategoryForm
            typeId={categoryModal.typeId}
            mode={categoryModal.mode}
            id={categoryModal.mode === "edit" ? categoryModal.category.id : undefined}
            initialName={categoryModal.mode === "edit" ? categoryModal.category.name : ""}
            initialColor={categoryModal.mode === "edit" ? categoryModal.category.color : null}
            onDone={() => setCategoryModal(null)}
          />
        )}
      </Modal>

      <Modal
        open={subModal !== null}
        onClose={() => setSubModal(null)}
        title={subModal?.mode === "edit" ? "Modifier la sous-catégorie" : "Nouvelle sous-catégorie"}
      >
        {subModal && (
          <SubcategoryForm
            categoryId={subModal.categoryId}
            mode={subModal.mode}
            id={subModal.mode === "edit" ? subModal.sub.id : undefined}
            initialName={subModal.mode === "edit" ? subModal.sub.name : ""}
            onDone={() => setSubModal(null)}
          />
        )}
      </Modal>
    </>
  );
}
