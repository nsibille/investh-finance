"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ShoppingBag,
  X,
  Archive,
  ArchiveRestore,
  Check,
  Repeat,
  Layers,
  FolderPlus,
  Unlink,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { formatMonthLabel } from "@/lib/format/date";
import { installmentOccurrence } from "@/lib/purchases/installments";
import { PurchaseForm } from "./PurchaseForm";
import {
  deletePurchase,
  setPurchaseArchived,
  setPurchaseParent,
  addInstallment,
  deleteInstallment,
} from "@/server/actions/purchases";
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

function parseAmount(s: string): number {
  return parseFloat(s.replace(/[\s€]/g, "").replace(",", "."));
}

/** Lignes de mensualités. `onRemove` fourni → mode édition (bouton supprimer
 *  sur les mensualités non appariées) ; absent → lecture seule. */
function InstallmentRows({
  purchase,
  onRemove,
}: {
  purchase: PurchaseWithDetails;
  onRemove?: (id: string) => void;
}) {
  if (purchase.installments.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {purchase.installments.map((inst) => {
        // Mensualités triées par mois : la 1re est le mois de départ.
        const startMonth = purchase.installments[0]?.month ?? inst.month;
        const total = purchase.installments.length;
        const occurrence = installmentOccurrence(startMonth, inst.month);
        // Abonnement sans fin : total inconnu → « N/∞ ».
        const endless = purchase.is_recurring && !purchase.recurrence_end;
        return (
          <div key={inst.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", opacity: inst.transaction_id ? 1 : 0.7 }}>
            <span style={{ flex: 1, textTransform: "capitalize" }}>
              {formatMonthLabel(inst.month)}
              {(total > 1 || endless) && (
                <span style={{ marginLeft: 6, fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "none", fontFamily: "var(--font-mono)" }}>
                  {occurrence}/{endless ? "∞" : total}
                </span>
              )}
            </span>
            <Amount value={Number(inst.amount)} size="sm" tone="neutral" />
            {inst.transaction_id ? (
              <span title="Appariée à une transaction" style={{ color: "var(--color-success)", display: "inline-flex" }}>
                <Check size={15} aria-hidden />
              </span>
            ) : onRemove ? (
              <IconButton label="Supprimer" onClick={() => onRemove(inst.id)}>
                <X size={14} />
              </IconButton>
            ) : (
              <span title="Prévue, non appariée" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                à venir
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Affichage lecture seule de l'échéancier (cartes de la liste des achats). */
function InstallmentList({ purchase }: { purchase: PurchaseWithDetails }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
        Mensualités prévisionnelles
      </span>
      <InstallmentRows purchase={purchase} />
    </div>
  );
}

/** Édition de l'échéancier (modale d'édition) : suppression ligne à ligne +
 *  ajout d'une mensualité. En-tête porté par le `FormField` « Échéancier ». */
function InstallmentEditor({ purchase }: { purchase: PurchaseWithDetails }) {
  const router = useRouter();
  const toast = useToast();
  const [month, setMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!month) return toast.error("Choisis un mois.");
    const value = parseAmount(amount);
    if (!Number.isFinite(value)) return toast.error("Montant invalide.");
    setBusy(true);
    const res = await addInstallment(purchase.id, `${month}-01`, value);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setMonth("");
    setAmount("");
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteInstallment(id);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <InstallmentRows purchase={purchase} onRemove={remove} />
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input-text-md"
          style={{ maxWidth: 160 }}
        />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Montant"
          style={{ maxWidth: 120 }}
        />
        <Button variant="secondary" size="sm" loading={busy} onClick={add}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}

export function PurchasesManager({
  purchases,
  subcategoryOptions,
  merchantOptions,
}: {
  purchases: PurchaseWithDetails[];
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<PurchaseWithDetails | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = purchases.filter((p) => p.is_archived).length;

  // Options « groupe parent » pour le formulaire (tous les achats).
  const parentOptions: PurchaseParentOption[] = purchases.map((p) => ({
    id: p.id,
    name: p.name,
    parentId: p.parent_id,
    isArchived: p.is_archived,
  }));

  // Arborescence à afficher. Un achat dont le parent est masqué remonte à la
  // racine (il ne disparaît pas).
  const shown = purchases.filter((p) => showArchived || !p.is_archived);
  const shownIds = new Set(shown.map((p) => p.id));
  const childrenOf = new Map<string, PurchaseWithDetails[]>();
  for (const p of shown) {
    const parent =
      p.parent_id && shownIds.has(p.parent_id) ? p.parent_id : ROOT;
    const list = childrenOf.get(parent) ?? [];
    list.push(p);
    childrenOf.set(parent, list);
  }
  const roots = childrenOf.get(ROOT) ?? [];

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

  /** Carte d'un achat + rendu récursif de ses sous-achats. */
  function PurchaseNode({
    purchase: p,
    depth,
  }: {
    purchase: PurchaseWithDetails;
    depth: number;
  }) {
    const children = childrenOf.get(p.id) ?? [];
    const isGroup = children.length > 0 || p.descendantCount > 0;
    const inGroup = !!(p.parent_id && shownIds.has(p.parent_id));
    const endlessSub = p.is_recurring && !p.recurrence_end;

    return (
      <Card key={p.id}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", opacity: p.is_archived ? 0.6 : 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <span style={{ fontWeight: "var(--fw-semibold)" }}>{p.name}</span>
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

          {p.installments.length > 0 && (
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)" }}>
              <InstallmentList purchase={p} />
            </div>
          )}

          {/* Sous-achats (rendu récursif). */}
          {children.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                marginTop: "var(--space-1)",
                paddingLeft: "var(--space-3)",
                borderLeft: "2px solid var(--color-border)",
              }}
            >
              {children.map((c) => (
                <PurchaseNode key={c.id} purchase={c} depth={depth + 1} />
              ))}
            </div>
          )}

          {!p.is_archived && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<FolderPlus size={15} />}
                onClick={() => setModal({ mode: "create", parentId: p.id })}
              >
                Ajouter un achat au groupe
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", visibility: archivedCount > 0 ? "visible" : "hidden" }}>
          <Checkbox checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les archivés ({archivedCount})
        </label>
        <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
          Nouvel achat
        </Button>
      </div>

      {roots.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="Aucun achat"
            description="Crée un achat pour regrouper des transactions (ex. un meuble payé en plusieurs fois), ou un groupe pour budgéter un voyage ou un projet de travaux."
            action={
              <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
                Nouvel achat
              </Button>
            }
          />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "var(--space-4)", alignItems: "start" }}>
          {roots.map((p) => (
            <PurchaseNode key={p.id} purchase={p} depth={0} />
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
