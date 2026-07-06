"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Repeat,
  Layers,
  FolderPlus,
  Unlink,
  CheckCircle2,
  RotateCcw,
  Store,
  Gift,
  HandCoins,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Dot } from "@/components/ui/Badge";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { useToast } from "@/hooks/useToast";
import { PurchaseForm } from "./PurchaseForm";
import { InstallmentEditor } from "./InstallmentEditor";
import { PurchaseGalaxy } from "./PurchaseGalaxy";
import { PurchaseAssignments } from "./PurchaseAssignments";
import {
  deletePurchase,
  setPurchaseArchived,
  setPurchaseParent,
  setPurchaseSettled,
  setPurchaseSubcategory,
} from "@/server/actions/purchases";
import type {
  PurchaseDetail,
  PurchaseParentOption,
} from "@/lib/purchases/types";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";

type ModalState =
  | { mode: "create"; parentId: string }
  | { mode: "edit" }
  | null;

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-wide)",
        }}
      >
        {label}
      </span>
      {value}
    </span>
  );
}

/**
 * `purchase-detail-page` — vue détaillée d'un achat : en-tête + actions +
 * KPIs, puis la « galaxie » (parent, paiements à venir/validés, transactions
 * rattachées, sous-achats listés comme des transactions).
 */
export function PurchaseDetailView({
  detail: p,
  subcategoryOptions,
  merchantOptions,
  parentOptions,
}: {
  detail: PurchaseDetail;
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  parentOptions: PurchaseParentOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isGroup = p.childIds.length > 0 || p.descendantCount > 0;
  const endless = p.is_recurring && !p.recurrence_end;
  // « Soldé » manuel : pertinent pour les achats sans échéancier complet
  // (les autres sont soldés automatiquement). Jamais pour un groupe/abonnement.
  const canSettle = !isGroup && !endless && !p.autoSettled;

  async function handleDelete() {
    setConfirmDelete(false);
    const res = await deletePurchase(p.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Achat supprimé");
    router.push("/achats");
  }

  async function toggleArchive() {
    const res = await setPurchaseArchived(p.id, !p.is_archived);
    if (!res.ok) return toast.error(res.error);
    toast.success(p.is_archived ? "Achat désarchivé" : "Achat archivé");
    router.refresh();
  }

  async function removeFromGroup() {
    const res = await setPurchaseParent(p.id, null);
    if (!res.ok) return toast.error(res.error);
    toast.success("Achat retiré du groupe");
    router.refresh();
  }

  async function toggleSettled() {
    const next = !p.is_settled;
    const res = await setPurchaseSettled(p.id, next);
    if (!res.ok) return toast.error(res.error);
    toast.success(next ? "Achat soldé" : "Achat rouvert");
    router.refresh();
  }

  async function changeCategory(subId: string | null) {
    const res = await setPurchaseSubcategory(p.id, subId);
    if (!res.ok) return toast.error(res.error);
    toast.success("Catégorie mise à jour");
    router.refresh();
  }

  return (
    <>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", opacity: p.is_archived ? 0.7 : 1 }}>
          {/* En-tête : titre + badges + actions */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--fw-semibold)", margin: 0, letterSpacing: "var(--tracking-tight)" }}>
                  {p.name}
                </h1>
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
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {canSettle && (
                <Button
                  variant={p.is_settled ? "ghost" : "secondary"}
                  size="sm"
                  leftIcon={p.is_settled ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />}
                  onClick={toggleSettled}
                >
                  {p.is_settled ? "Rouvrir" : "Marquer comme soldé"}
                </Button>
              )}
              <Button variant="secondary" size="sm" leftIcon={<Pencil size={15} />} onClick={() => setModal({ mode: "edit" })}>
                Modifier
              </Button>
              {p.parent && (
                <Button variant="ghost" size="sm" leftIcon={<Unlink size={15} />} onClick={removeFromGroup}>
                  Retirer du groupe
                </Button>
              )}
              <Button variant="ghost" size="sm" leftIcon={p.is_archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} onClick={toggleArchive}>
                {p.is_archived ? "Désarchiver" : "Archiver"}
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>
                Supprimer
              </Button>
            </div>
          </div>

          {p.description && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: 0 }}>
              {p.description}
            </p>
          )}

          {/* Métadonnées : catégorie (éditable) · enseigne · personnes */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-6)",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 220 }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
                Catégorie
              </span>
              <CategorySelect
                value={p.subcategory_id}
                options={subcategoryOptions}
                onChange={changeCategory}
                allowCreate
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
                Enseigne
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", height: 36, color: p.merchantName ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                <Store size={15} aria-hidden />
                {p.merchantName ?? "—"}
              </span>
            </div>

            {p.persons.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
                  Personnes
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  {p.persons.map((s) => (
                    <span
                      key={`${s.personId}-${s.nature}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}
                    >
                      <Dot color={s.color} />
                      <span style={{ minWidth: 0 }}>{s.name}</span>
                      <span
                        title={s.nature === "debt" ? "Créance (à te rembourser)" : "Cadeau offert"}
                        style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "var(--text-xs)", color: s.nature === "debt" ? "var(--color-warning-dark)" : "var(--color-finance-investissement)" }}
                      >
                        {s.nature === "debt" ? <HandCoins size={13} aria-hidden /> : <Gift size={13} aria-hidden />}
                        {s.nature === "debt" ? "Dette" : "Cadeau"}
                      </span>
                      <Amount value={s.amount} size="sm" tone="neutral" />
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-6)",
              flexWrap: "wrap",
              padding: "var(--space-4)",
              background: "var(--color-bg-subtle)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Stat
              label={isGroup ? "Total dépensé (groupe)" : "Total dépensé"}
              value={<Amount value={p.totalPaidAmount} size="lg" tone="neutral" />}
            />
            {p.totalForecastAmount !== 0 && (
              <Stat label="Budget prévu" value={<Amount value={p.totalForecastAmount} size="lg" tone="neutral" />} />
            )}
            {p.totalRemaining > 0 && !endless && (
              <Stat label="Reste à payer" value={<Amount value={-p.totalRemaining} size="lg" tone="neutral" />} />
            )}
            <Stat
              label="Transactions"
              value={
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-lg)", fontWeight: "var(--fw-semibold)" }}>
                  {p.totalTransactionCount}
                </span>
              }
            />
          </div>

          {/* Galaxie dépliée : les sections paiements + transactions sont
              remplacées par le bloc interactif d'assignation. */}
          <PurchaseGalaxy
            purchase={p}
            parent={p.parent}
            subPurchases={p.children}
            variant="page"
            assignmentsSlot={<PurchaseAssignments purchase={p} />}
          />

          {!p.is_archived && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<FolderPlus size={15} />}
                onClick={() => setModal({ mode: "create", parentId: p.id })}
              >
                Ajouter un achat à ce groupe
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier l'achat" : "Nouvel achat dans le groupe"}
      >
        {modal && (
          <PurchaseForm
            mode={modal.mode}
            id={modal.mode === "edit" ? p.id : undefined}
            initial={
              modal.mode === "edit"
                ? {
                    name: p.name,
                    description: p.description,
                    subcategoryId: p.subcategory_id,
                    merchantId: p.merchant_id,
                    parentId: p.parent_id,
                  }
                : undefined
            }
            subcategoryOptions={subcategoryOptions}
            merchantOptions={merchantOptions}
            parentOptions={parentOptions}
            defaultParentId={modal.mode === "create" ? modal.parentId : null}
            installmentsEditor={modal.mode === "edit" ? <InstallmentEditor purchase={p} /> : null}
            onDone={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer l'achat ?"
        variantClass="modal-confirm-danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
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
          {p.childIds.length > 0 && (
            <> Les sous-achats de ce groupe seront rattachés à la racine (non supprimés).</>
          )}
        </Alert>
      </Modal>
    </>
  );
}
