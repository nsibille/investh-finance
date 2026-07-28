"use client";

import { useMemo, useState } from "react";
import { ShoppingBag, Store, Repeat, Users, X } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { Dot } from "@/components/ui/Badge";
import { CategoryInlineEditor } from "./CategoryInlineEditor";
import { NoteCell } from "./NoteCell";
import { PurchaseAttachModal } from "@/components/import/PurchaseAttachModal";
import { MerchantAttachModal } from "@/components/import/MerchantAttachModal";
import { RecurringAttachModal } from "@/components/import/RecurringAttachModal";
import { PersonAttachModal } from "@/components/import/PersonAttachModal";
import { MerchantEditModal } from "@/components/merchants/MerchantEditModal";
import { RecurringEditModal } from "@/components/recurring/RecurringEditModal";
import { PurchaseEditModal } from "@/components/purchases/PurchaseEditModal";
import { formatShortDate } from "@/lib/format/date";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { PurchaseOption, InstallmentChoice } from "@/lib/purchases/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringOption } from "@/lib/recurring/queries";
import type {
  PersonOption,
  SplitNature,
  TransactionSplit,
} from "@/lib/persons/types";
import type { TransactionStatus } from "@/lib/transactions/types";
import type { ReactNode } from "react";

/** Vue normalisée d'une ligne éditable, commune à l'import et à la liste. */
export interface EditorRowVM {
  /** Clé stable : index d'aperçu (import) ou id de transaction (liste). */
  key: string;
  operationDate: string;
  account?: { name: string; color: string | null } | null;
  label: string;
  /** Libellé bancaire d'origine (jamais masqué : sert de garde-fou sous l'enseigne). */
  rawLabel?: string | null;
  amount: number;
  currency: string;
  categoryId: string | null;
  purchase?: {
    id: string;
    name: string;
    occurrence?: number | null;
    installmentTotal?: number | null;
    endless?: boolean;
  } | null;
  merchant?: { id: string; name: string; locked?: boolean } | null;
  recurring?: { id: string; name: string } | null;
  /** Résumé affiché du partage (nb personnes + nature). */
  personsBadge?: { count: number; nature: SplitNature } | null;
  /** État initial du partage pour la modale (connu à l'import ; null en liste). */
  personsInitial?: { nature: SplitNature; personIds: string[] } | null;
  /** Ventilation complète (nature + montants) pour l'éditeur riche en liste. */
  personsSplit?: TransactionSplit | null;
  note: string | null;
  /** Statut de la transaction (liste ; absent à l'import). */
  status?: TransactionStatus;
  /** Ligne grisée (doublon décoché à l'import). */
  dimmed?: boolean;
  /** Doublon déjà en base (import) : style dédié. */
  isExistingDuplicate?: boolean;
}

export interface EditorHandlers {
  onAssignCategory: (key: string, subId: string | null) => void;
  onCreateCategory: (key: string, name: string) => void;
  onAttachPurchase: (
    key: string,
    option: PurchaseOption,
    choice: InstallmentChoice,
  ) => void;
  onDetachPurchase: (key: string) => void;
  onAttachMerchant: (key: string, option: MerchantOption) => void;
  onDetachMerchant: (key: string) => void;
  onAttachRecurring: (key: string, option: RecurringOption) => void;
  onCreateRecurring: (key: string, name: string) => void;
  /** Détacher une récurrente (liste). Absent ⇒ pas de bouton détacher. */
  onDetachRecurring?: (key: string) => void;
  onSharePersons: (
    key: string,
    value: { nature: SplitNature; personIds: string[] } | null,
  ) => void;
  onSaveNote: (key: string, note: string) => void | Promise<void>;
}

/**
 * Table éditrice mutualisée par l'aperçu d'import et la liste des transactions :
 * catégorie inline, rattachement achat/enseigne/récurrente, partage entre
 * personnes et annotation. La colonne de fin (statut/inclure ou statut/actions)
 * et la persistance sont fournies par le parent via `handlers` et les
 * render-props — la gestion des doublons reste propre à l'import.
 */
export function TransactionEditorTable({
  rows,
  handlers,
  subcategoryOptions,
  purchaseOptions,
  merchantOptions,
  recurringOptions,
  personOptions,
  showAccount = false,
  trailingHeader,
  renderTrailing,
  filterRow,
  renderPersonModal,
}: {
  rows: EditorRowVM[];
  handlers: EditorHandlers;
  subcategoryOptions: SubcategoryOption[];
  purchaseOptions: PurchaseOption[];
  merchantOptions: MerchantOption[];
  recurringOptions: RecurringOption[];
  personOptions: PersonOption[];
  showAccount?: boolean;
  trailingHeader?: React.ReactNode;
  renderTrailing?: (row: EditorRowVM) => React.ReactNode;
  filterRow?: (row: EditorRowVM) => boolean;
  /**
   * Éditeur de partage personnalisé (liste des transactions : éditeur riche
   * avec montants). Absent ⇒ modale légère par défaut (aperçu d'import).
   */
  renderPersonModal?: (row: EditorRowVM, close: () => void) => ReactNode;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [purchaseKey, setPurchaseKey] = useState<string | null>(null);
  const [merchantKey, setMerchantKey] = useState<string | null>(null);
  const [recurringKey, setRecurringKey] = useState<string | null>(null);
  const [personKey, setPersonKey] = useState<string | null>(null);
  // Édition directe de l'entité enseigne/récurrente/achat (clic sur le flag).
  const [editMerchantId, setEditMerchantId] = useState<string | null>(null);
  const [editRecurringId, setEditRecurringId] = useState<string | null>(null);
  const [editPurchaseId, setEditPurchaseId] = useState<string | null>(null);

  const optLabel = useMemo(
    () => new Map(subcategoryOptions.map((o) => [o.id, o.label])),
    [subcategoryOptions],
  );
  const rowByKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const visible = filterRow ? rows.filter(filterRow) : rows;
  const visibleKeys = visible.map((r) => r.key);
  function nextKey(key: string): string | null {
    const i = visibleKeys.indexOf(key);
    return i >= 0 && i + 1 < visibleKeys.length ? visibleKeys[i + 1] : null;
  }

  const purchaseRow = purchaseKey ? rowByKey.get(purchaseKey) : null;
  const personRow = personKey ? rowByKey.get(personKey) : null;
  const merchantRow = merchantKey ? rowByKey.get(merchantKey) : null;

  return (
    <>
      <table className="table-transaction-editor">
        <thead>
          <tr>
            <th style={{ width: 104 }}>Date</th>
            {showAccount && <th style={{ width: 128 }}>Compte</th>}
            <th>Libellé</th>
            <th style={{ width: 200 }}>Catégorie</th>
            <th style={{ width: 116, textAlign: "right" }}>Montant</th>
            <th style={{ width: 56, textAlign: "center" }}>Note</th>
            {trailingHeader ?? null}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr
              key={r.key}
              data-excluded={r.dimmed || undefined}
              data-duplicate={r.isExistingDuplicate ? "existing" : undefined}
            >
              <td>{formatShortDate(r.operationDate)}</td>

              {showAccount && (
                <td data-col="account" style={{ color: "var(--color-text-muted)" }} title={r.account?.name}>
                  {r.account && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <Dot color={r.account.color ?? undefined} />
                      {r.account.name}
                    </span>
                  )}
                </td>
              )}

              <td data-col="label">
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>{r.label}</span>

                  {r.recurring ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: "var(--color-brand-primary-600)" }}>
                      <Repeat size={12} aria-hidden />
                      <button
                        type="button"
                        className="flag-editable"
                        title="Voir / modifier la récurrente"
                        onClick={() => setEditRecurringId(r.recurring!.id)}
                        style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit" }}
                      >
                        Récurrent · {r.recurring.name}
                      </button>
                      {handlers.onDetachRecurring && (
                        <button
                          type="button"
                          aria-label="Détacher la récurrente"
                          onClick={() => handlers.onDetachRecurring!(r.key)}
                          style={{ background: "none", border: "none", padding: 0, display: "inline-flex", color: "var(--color-text-muted)", cursor: "pointer" }}
                        >
                          <X size={11} aria-hidden />
                        </button>
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Associer une récurrente"
                      onClick={() => setRecurringKey(r.key)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", background: "none", border: "none", padding: 0, fontSize: "var(--text-xs)", color: "var(--color-text-muted)", cursor: "pointer", opacity: 0.75 }}
                    >
                      <Repeat size={12} aria-hidden />
                      Récurrence…
                    </button>
                  )}

                  {r.merchant ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                      <Store size={12} aria-hidden />
                      {/* Clic sur le nom = éditer les paramètres de l'enseigne.
                          Changer d'enseigne = détacher (croix) puis en ré-ajouter. */}
                      <button
                        type="button"
                        className="flag-editable"
                        title={
                          r.merchant.locked
                            ? "Enseigne imposée par l'achat — modifier ses paramètres"
                            : "Modifier l'enseigne"
                        }
                        onClick={() => setEditMerchantId(r.merchant!.id)}
                        style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "var(--color-brand-primary-600)" }}
                      >
                        {r.merchant.name}
                      </button>
                      {!r.merchant.locked && (
                        <button
                          type="button"
                          aria-label="Détacher l'enseigne"
                          onClick={() => handlers.onDetachMerchant(r.key)}
                          style={{ background: "none", border: "none", padding: 0, display: "inline-flex", color: "var(--color-text-muted)", cursor: "pointer" }}
                        >
                          <X size={11} aria-hidden />
                        </button>
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMerchantKey(r.key)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", background: "none", border: "none", padding: 0, fontSize: "var(--text-xs)", color: "var(--color-text-muted)", cursor: "pointer", opacity: 0.75 }}
                    >
                      <Store size={12} aria-hidden />
                      Enseigne…
                    </button>
                  )}

                  {r.personsBadge && r.personsBadge.count > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPersonKey(r.key)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", background: "none", border: "none", padding: 0, fontSize: "var(--text-xs)", color: "var(--color-brand-primary-600)", cursor: "pointer" }}
                    >
                      <Users size={12} aria-hidden />
                      {r.personsBadge.count} personne{r.personsBadge.count > 1 ? "s" : ""} ·{" "}
                      {r.personsBadge.nature === "gift"
                        ? "cadeau"
                        : r.amount > 0
                          ? "à rendre"
                          : "dette"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPersonKey(r.key)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", background: "none", border: "none", padding: 0, fontSize: "var(--text-xs)", color: "var(--color-text-muted)", cursor: "pointer", opacity: 0.75 }}
                    >
                      <Users size={12} aria-hidden />
                      Partager…
                    </button>
                  )}

                  {r.purchase ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: "var(--color-brand-primary-600)" }}>
                      <ShoppingBag size={12} aria-hidden />
                      <button
                        type="button"
                        className="flag-editable"
                        title="Voir / modifier l'achat"
                        onClick={() => setEditPurchaseId(r.purchase!.id)}
                        style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit" }}
                      >
                        {r.purchase.name}
                      </button>
                      {(() => {
                        const total = r.purchase.installmentTotal ?? 0;
                        if (r.purchase.occurrence == null || (!r.purchase.endless && total <= 1)) return null;
                        return (
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                            {r.purchase.occurrence}/{r.purchase.endless ? "∞" : total}
                          </span>
                        );
                      })()}
                      <button
                        type="button"
                        aria-label="Détacher l'achat"
                        onClick={() => handlers.onDetachPurchase(r.key)}
                        style={{ background: "none", border: "none", padding: 0, display: "inline-flex", color: "var(--color-text-muted)", cursor: "pointer" }}
                      >
                        <X size={11} aria-hidden />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Rattacher à un achat"
                      onClick={() => setPurchaseKey(r.key)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", background: "none", border: "none", padding: 0, fontSize: "var(--text-xs)", color: "var(--color-text-muted)", cursor: "pointer", opacity: 0.75 }}
                    >
                      <ShoppingBag size={12} aria-hidden />
                      Achat…
                    </button>
                  )}
                </div>
              </td>

              <td data-col="category">
                {editing === r.key ? (
                  <CategoryInlineEditor
                    options={subcategoryOptions}
                    value={r.categoryId}
                    onSelect={(id) => handlers.onAssignCategory(r.key, id)}
                    onCreate={(name) => handlers.onCreateCategory(r.key, name)}
                    onTabNext={() => setEditing(nextKey(r.key))}
                    onClose={() => setEditing(null)}
                  />
                ) : (
                  <button
                    type="button"
                    className="import-cat-edit"
                    onClick={() => setEditing(r.key)}
                    data-empty={r.categoryId ? undefined : "true"}
                  >
                    {r.categoryId ? (optLabel.get(r.categoryId) ?? "—") : "Non catégorisée"}
                  </button>
                )}
              </td>

              <td style={{ textAlign: "right" }}>
                <Amount value={r.amount} currency={r.currency} />
              </td>

              <td style={{ textAlign: "center" }}>
                <NoteCell note={r.note} onSave={(v) => handlers.onSaveNote(r.key, v)} />
              </td>

              {renderTrailing ? renderTrailing(r) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <PurchaseAttachModal
        open={purchaseKey !== null}
        onClose={() => setPurchaseKey(null)}
        purchaseOptions={purchaseOptions}
        fromTransaction={
          purchaseRow
            ? {
                operationDate: purchaseRow.operationDate,
                amount: purchaseRow.amount,
                label: purchaseRow.label,
              }
            : null
        }
        onAttach={(option, choice) => {
          if (purchaseKey !== null)
            handlers.onAttachPurchase(purchaseKey, option, choice);
        }}
      />

      <MerchantAttachModal
        open={merchantKey !== null}
        onClose={() => setMerchantKey(null)}
        merchantOptions={merchantOptions}
        defaultSubcategoryId={merchantRow?.categoryId ?? null}
        onAttach={(option) => {
          if (merchantKey !== null) handlers.onAttachMerchant(merchantKey, option);
        }}
      />

      <RecurringAttachModal
        open={recurringKey !== null}
        onClose={() => setRecurringKey(null)}
        options={recurringOptions}
        onAttach={(option) => {
          if (recurringKey !== null) handlers.onAttachRecurring(recurringKey, option);
        }}
        onCreate={(name) => {
          if (recurringKey !== null) handlers.onCreateRecurring(recurringKey, name);
        }}
      />

      {renderPersonModal
        ? personRow
          ? renderPersonModal(personRow, () => setPersonKey(null))
          : null
        : (
          <PersonAttachModal
            key={personKey ?? "none"}
            open={personKey !== null}
            onClose={() => setPersonKey(null)}
            persons={personOptions}
            initial={personRow?.personsInitial ?? null}
            onAttach={(value) => {
              if (personKey !== null) handlers.onSharePersons(personKey, value);
            }}
          />
        )}

      <MerchantEditModal
        merchantId={editMerchantId}
        onClose={() => setEditMerchantId(null)}
        subcategoryOptions={subcategoryOptions}
      />

      <RecurringEditModal
        recurringId={editRecurringId}
        onClose={() => setEditRecurringId(null)}
        subcategoryOptions={subcategoryOptions}
        merchantOptions={merchantOptions}
      />

      <PurchaseEditModal
        purchaseId={editPurchaseId}
        onClose={() => setEditPurchaseId(null)}
        subcategoryOptions={subcategoryOptions}
        merchantOptions={merchantOptions}
      />
    </>
  );
}
