"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  ShoppingBag,
  Archive,
  ArchiveRestore,
  Repeat,
  Layers,
  FolderPlus,
  Unlink,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { PurchaseForm } from "./PurchaseForm";
import { InstallmentEditor } from "./InstallmentEditor";
import { PurchaseGalaxy } from "./PurchaseGalaxy";
import {
  deletePurchase,
  setPurchaseArchived,
  setPurchaseParent,
  setPurchaseSettled,
} from "@/server/actions/purchases";
import { matchesQuery } from "@/lib/search/filter";
import type {
  PurchaseWithDetails,
  PurchaseParentOption,
} from "@/lib/purchases/types";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";

type ModalState =
  | { mode: "create"; parentId?: string | null }
  | { mode: "edit"; purchaseId: string }
  | null;

const ROOT = "__root__";

export function PurchasesManager({
  purchases,
  subcategoryOptions,
  merchantOptions,
  scope = "active",
}: {
  purchases: PurchaseWithDetails[];
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  /** "active" = achats en cours (défaut) ; "done" = achats terminés (soldés). */
  scope?: "active" | "done";
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<PurchaseWithDetails | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");

  const archivedCount = purchases.filter((p) => p.is_archived).length;

  // Recherche : nom, description, catégorie et enseigne de l'achat. On conserve
  // la connectivité de l'arbre — un achat matché tire ses parents et ses
  // sous-achats pour que le groupe reste lisible. `null` ⇒ pas de recherche.
  const queryVisible = useMemo(() => {
    if (!query.trim()) return null;
    const byId = new Map(purchases.map((p) => [p.id, p]));
    const childrenMap = new Map<string, string[]>();
    for (const p of purchases) {
      if (!p.parent_id) continue;
      const list = childrenMap.get(p.parent_id) ?? [];
      list.push(p.id);
      childrenMap.set(p.parent_id, list);
    }
    const keep = new Set<string>();
    const addDescendants = (id: string) => {
      for (const childId of childrenMap.get(id) ?? []) {
        if (keep.has(childId)) continue;
        keep.add(childId);
        addDescendants(childId);
      }
    };
    for (const p of purchases) {
      const hit = matchesQuery(query, [
        p.name,
        p.description,
        p.categoryLabel,
        p.merchantName,
      ]);
      if (!hit) continue;
      keep.add(p.id);
      let parentId = p.parent_id;
      while (parentId) {
        keep.add(parentId);
        parentId = byId.get(parentId)?.parent_id ?? null;
      }
      addDescendants(p.id);
    }
    return keep;
  }, [purchases, query]);

  // Options « groupe parent » pour le formulaire (tous les achats).
  const parentOptions: PurchaseParentOption[] = purchases.map((p) => ({
    id: p.id,
    name: p.name,
    parentId: p.parent_id,
    isArchived: p.is_archived,
  }));

  // Arborescence à afficher. Un achat dont le parent est masqué remonte à la
  // racine (il ne disparaît pas).
  const shown = purchases.filter(
    (p) =>
      (showArchived || !p.is_archived) &&
      (queryVisible === null || queryVisible.has(p.id)),
  );
  const shownIds = new Set(shown.map((p) => p.id));
  const childrenOf = new Map<string, PurchaseWithDetails[]>();
  for (const p of shown) {
    const parent =
      p.parent_id && shownIds.has(p.parent_id) ? p.parent_id : ROOT;
    const list = childrenOf.get(parent) ?? [];
    list.push(p);
    childrenOf.set(parent, list);
  }
  const allRoots = childrenOf.get(ROOT) ?? [];
  // Un achat racine « terminé » = soldé et sans sous-achat (les groupes restent
  // toujours dans l'écran principal). Les soldés sont rangés à part.
  const isDone = (p: PurchaseWithDetails) =>
    p.isFullyPaid && p.descendantCount === 0;
  const doneCount = allRoots.filter(isDone).length;
  const roots = allRoots.filter((p) => (scope === "done" ? isDone(p) : !isDone(p)));

  // Résolu depuis les props (et non figé dans l'état) : après ajout/suppression
  // d'une mensualité + refresh, la modale reflète l'échéancier à jour.
  const editingPurchase =
    modal?.mode === "edit"
      ? purchases.find((p) => p.id === modal.purchaseId) ?? null
      : null;

  async function handleDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    const res = await deletePurchase(target.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Achat supprimé");
    router.refresh();
  }

  async function toggleArchive(p: PurchaseWithDetails) {
    const res = await setPurchaseArchived(p.id, !p.is_archived);
    if (!res.ok) return toast.error(res.error);
    toast.success(p.is_archived ? "Achat désarchivé" : "Achat archivé");
    router.refresh();
  }

  async function removeFromGroup(p: PurchaseWithDetails) {
    const res = await setPurchaseParent(p.id, null);
    if (!res.ok) return toast.error(res.error);
    toast.success("Achat retiré du groupe");
    router.refresh();
  }

  async function toggleSettled(p: PurchaseWithDetails) {
    const next = !p.is_settled;
    const res = await setPurchaseSettled(p.id, next);
    if (!res.ok) return toast.error(res.error);
    toast.success(next ? "Achat soldé" : "Achat rouvert");
    router.refresh();
  }

  /** Carte d'un achat : résumé + galaxie (parent, paiements, transactions,
   *  sous-achats listés comme des transactions). */
  function PurchaseNode({ purchase: p }: { purchase: PurchaseWithDetails }) {
    const children = childrenOf.get(p.id) ?? [];
    const isGroup = children.length > 0 || p.descendantCount > 0;
    const inGroup = !!(p.parent_id && shownIds.has(p.parent_id));
    const endlessSub = p.is_recurring && !p.recurrence_end;
    // Solder manuellement : achats directs / partiels uniquement.
    const canSettle = !isGroup && !endlessSub && !p.autoSettled;

    return (
      <Card key={p.id}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", opacity: p.is_archived ? 0.6 : 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Link
                  href={`/achats/${p.id}`}
                  style={{ fontWeight: "var(--fw-semibold)", color: "var(--color-text-primary)", textDecoration: "none" }}
                >
                  {p.name}
                </Link>
                {isGroup && (
                  <span className="badge-group" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Layers size={11} aria-hidden />
                    Groupe · {p.descendantCount} sous-achat{p.descendantCount > 1 ? "s" : ""}
                  </span>
                )}
                {p.is_recurring && (
                  <span className="badge-status-pending" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Repeat size={11} aria-hidden />
                    {p.recurrence_end ? "Récurrent" : "Abonnement"}
                  </span>
                )}
                {p.isFullyPaid && !isGroup && <span className="badge-status-validated">Soldé</span>}
                {p.is_archived && <span className="badge-status-ignored">Archivé</span>}
              </div>
              {p.categoryLabel && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>
                  <Dot color={p.categoryColor ?? undefined} />
                  {p.categoryLabel}
                </div>
              )}
            </div>
            {canSettle && (
              <IconButton
                label={p.is_settled ? "Rouvrir (non soldé)" : "Marquer comme soldé"}
                onClick={() => toggleSettled(p)}
              >
                {p.is_settled ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
              </IconButton>
            )}
            {inGroup && (
              <IconButton label="Retirer du groupe" onClick={() => removeFromGroup(p)}>
                <Unlink size={16} />
              </IconButton>
            )}
            <IconButton label={p.is_archived ? "Désarchiver" : "Archiver"} onClick={() => toggleArchive(p)}>
              {p.is_archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            </IconButton>
            <IconButton label="Modifier" onClick={() => setModal({ mode: "edit", purchaseId: p.id })}>
              <Pencil size={16} />
            </IconButton>
            <IconButton label="Supprimer" onClick={() => setToDelete(p)}>
              <Trash2 size={16} />
            </IconButton>
          </div>

          {p.description && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: 0 }}>
              {p.description}
            </p>
          )}

          {isGroup && (
            <div
              style={{
                display: "flex",
                gap: "var(--space-4)",
                flexWrap: "wrap",
                padding: "var(--space-3)",
                background: "var(--color-bg-subtle)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
                  Total dépensé
                </span>
                <Amount value={p.totalPaidAmount} size="md" tone="neutral" />
              </span>
              {p.totalForecastAmount !== 0 && (
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
                    Budget prévu
                  </span>
                  <Amount value={p.totalForecastAmount} size="md" tone="neutral" />
                </span>
              )}
              {p.totalRemaining > 0 && (
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
                    Reste à payer
                  </span>
                  <Amount value={-p.totalRemaining} size="md" tone="neutral" />
                </span>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-sm)", flexWrap: "wrap" }}>
            <span style={{ color: "var(--color-text-muted)" }}>
              {p.transactionCount} transaction{p.transactionCount > 1 ? "s" : ""}
              {isGroup && " (directes)"}
            </span>
            <span>
              Payé <Amount value={p.paidAmount} size="sm" tone="neutral" />
            </span>
            {p.remaining > 0 && !endlessSub && (
              <span>
                Reste <Amount value={-p.remaining} size="sm" tone="neutral" />
              </span>
            )}
          </div>

          {/* Galaxie : parent · paiements à venir/validés · transactions
              rattachées · sous-achats listés comme des transactions. */}
          <PurchaseGalaxy
            purchase={p}
            parent={p.parentName ? { id: p.parent_id!, name: p.parentName } : null}
            subPurchases={children}
            variant="card"
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {!p.is_archived ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<FolderPlus size={15} />}
                onClick={() => setModal({ mode: "create", parentId: p.id })}
              >
                Ajouter un achat au groupe
              </Button>
            ) : (
              <span />
            )}
            <Link
              href={`/achats/${p.id}`}
              style={{ fontSize: "var(--text-sm)", color: "var(--color-text-link)", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              Voir le détail
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div style={{ marginBottom: "var(--space-4)", maxWidth: 360 }}>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un achat, une enseigne…"
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", visibility: archivedCount > 0 ? "visible" : "hidden" }}>
          <Checkbox checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les archivés ({archivedCount})
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          {scope === "active" ? (
            doneCount > 0 && (
              <Link
                href="/achats/termines"
                style={{ fontSize: "var(--text-sm)", color: "var(--color-text-link)", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                Voir les achats terminés ({doneCount})
                <ArrowRight size={14} aria-hidden />
              </Link>
            )
          ) : (
            <Link
              href="/achats"
              style={{ fontSize: "var(--text-sm)", color: "var(--color-text-link)", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <ArrowLeft size={14} aria-hidden />
              Achats en cours
            </Link>
          )}
          {scope === "active" && (
            <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
              Nouvel achat
            </Button>
          )}
        </div>
      </div>

      {roots.length === 0 && queryVisible !== null ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="Aucun résultat"
            description={`Aucun achat ne correspond à « ${query} ».`}
          />
        </Card>
      ) : roots.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title={scope === "done" ? "Aucun achat terminé" : "Aucun achat"}
            description={
              scope === "done"
                ? "Les achats que tu marques comme soldés apparaîtront ici."
                : "Crée un achat pour regrouper des transactions (ex. un meuble payé en plusieurs fois), ou un groupe pour budgéter un voyage ou un projet de travaux."
            }
            action={
              scope === "active" ? (
                <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
                  Nouvel achat
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "var(--space-4)", alignItems: "start" }}>
          {roots.map((p) => (
            <PurchaseNode key={p.id} purchase={p} />
          ))}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier l'achat" : "Nouvel achat"}
      >
        {modal && (
          <PurchaseForm
            mode={modal.mode}
            id={modal.mode === "edit" ? modal.purchaseId : undefined}
            initial={
              editingPurchase
                ? {
                    name: editingPurchase.name,
                    description: editingPurchase.description,
                    subcategoryId: editingPurchase.subcategory_id,
                    merchantId: editingPurchase.merchant_id,
                    parentId: editingPurchase.parent_id,
                  }
                : undefined
            }
            subcategoryOptions={subcategoryOptions}
            merchantOptions={merchantOptions}
            parentOptions={parentOptions}
            defaultParentId={modal.mode === "create" ? modal.parentId ?? null : null}
            installmentsEditor={
              editingPurchase ? <InstallmentEditor purchase={editingPurchase} /> : null
            }
            onDone={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer l'achat ?"
        variantClass="modal-confirm-danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Supprimer
            </Button>
          </>
        }
      >
        <Alert variant="warning">
          Les transactions rattachées seront détachées (elles gardent leur catégorie).
          Les mensualités seront supprimées.
          {toDelete && (toDelete.childIds.length > 0) && (
            <> Les sous-achats de ce groupe seront rattachés à la racine (non supprimés).</>
          )}
        </Alert>
      </Modal>
    </>
  );
}
