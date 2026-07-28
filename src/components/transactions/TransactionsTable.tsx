"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Store,
  Repeat,
  Users,
  Check,
  RotateCcw,
  Pencil,
  X,
} from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { Dot } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { CategoryInlineEditor } from "./CategoryInlineEditor";
import { MerchantQuickView } from "@/components/merchants/MerchantQuickView";
import { PurchaseAttachModal } from "@/components/import/PurchaseAttachModal";
import { MerchantAttachModal } from "@/components/import/MerchantAttachModal";
import { RecurringAttachModal } from "@/components/import/RecurringAttachModal";
import { MerchantEditModal } from "@/components/merchants/MerchantEditModal";
import { RecurringEditModal } from "@/components/recurring/RecurringEditModal";
import { PurchaseEditModal } from "@/components/purchases/PurchaseEditModal";
import { formatShortDate } from "@/lib/format/date";
import type { EditorRowVM, EditorHandlers } from "./TransactionEditorTable";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { PurchaseOption } from "@/lib/purchases/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringOption } from "@/lib/recurring/queries";
import type { PersonOption } from "@/lib/persons/types";
import type { TransactionStatus } from "@/lib/transactions/types";

/** Actions de statut propres à la liste, en plus des rattachements partagés. */
export interface ListHandlers extends EditorHandlers {
  onValidate: (key: string) => void;
  onSetStatus: (key: string, status: TransactionStatus) => void;
}

/** Découpe une catégorie en chemin parent (ellipsable) + feuille (jamais tronquée). */
function splitCategory(o: SubcategoryOption): { path: string; leaf: string; full: string } {
  if (o.subName) {
    return {
      path: `${o.typeName} / ${o.categoryName}`,
      leaf: o.subName,
      full: o.label,
    };
  }
  return { path: o.typeName, leaf: o.categoryName, full: o.label };
}

function occurrenceLabel(p: NonNullable<EditorRowVM["purchase"]>): string | null {
  const total = p.installmentTotal ?? 0;
  if (p.occurrence == null || (!p.endless && total <= 1)) return null;
  return `${p.occurrence}/${p.endless ? "∞" : total}`;
}

/**
 * Table de la liste des transactions (`/transactions`) — maquette dédiée,
 * distincte de la table d'aperçu d'import (`table-transaction-editor`) :
 * - colonne principale : enseigne (si connue) sinon libellé, en titre ; en
 *   sous-lignes achat · récurrence · personnes · libellé (quand l'enseigne
 *   occupe le titre) ;
 * - colonne compte + date mutualisée ;
 * - catégorie = pastille couleur + nom complet sans retour ligne (chemin parent
 *   ellipsé, révélé au survol) ;
 * - colonne actions : enseigne, achat, récurrence, partage, valider/invalider,
 *   détail.
 */
export function TransactionsTable({
  rows,
  handlers,
  subcategoryOptions,
  purchaseOptions,
  merchantOptions,
  recurringOptions,
  renderPersonModal,
}: {
  rows: EditorRowVM[];
  handlers: ListHandlers;
  subcategoryOptions: SubcategoryOption[];
  purchaseOptions: PurchaseOption[];
  merchantOptions: MerchantOption[];
  recurringOptions: RecurringOption[];
  personOptions: PersonOption[];
  renderPersonModal: (row: EditorRowVM, close: () => void) => ReactNode;
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

  const optById = useMemo(
    () => new Map(subcategoryOptions.map((o) => [o.id, o])),
    [subcategoryOptions],
  );
  const rowByKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const keys = rows.map((r) => r.key);
  function nextKey(key: string): string | null {
    const i = keys.indexOf(key);
    return i >= 0 && i + 1 < keys.length ? keys[i + 1] : null;
  }

  const purchaseRow = purchaseKey ? rowByKey.get(purchaseKey) : null;
  const merchantRow = merchantKey ? rowByKey.get(merchantKey) : null;
  const personRow = personKey ? rowByKey.get(personKey) : null;

  return (
    <>
      <table className="table-transactions-list">
        <thead>
          <tr>
            <th>Transaction</th>
            <th style={{ width: 160 }}>Compte · date</th>
            <th style={{ width: 208 }}>Catégorie</th>
            <th style={{ width: 132, textAlign: "right" }}>Montant</th>
            <th style={{ width: 188, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const opt = r.categoryId ? optById.get(r.categoryId) : null;
            const cat = opt ? splitCategory(opt) : null;
            const status: TransactionStatus = r.status ?? "pending";
            // Anatomie constante d'une ligne : titre = enseigne (si connue),
            // sinon libellé bancaire ; quand une enseigne occupe le titre, le
            // Anatomie de ligne constante : le libellé bancaire d'origine est
            // TOUJOURS le titre (grand). L'enseigne, l'achat, la récurrente… sont
            // des méta rappelés en dessous (garde-fou : jamais masquer le libellé).
            const rawLabel = r.rawLabel ?? r.label;

            return (
              <tr key={r.key}>
                {/* — Colonne principale — */}
                <td data-col="main">
                  <div className="tx-main">
                    <div className="tx-main__title">
                      <code className="tx-label-code">{rawLabel}</code>
                    </div>
                    <div className="tx-main__meta">
                      {r.merchant && (
                        <MerchantQuickView
                          merchantId={r.merchant.id}
                          name={r.merchant.name}
                          onEdit={() => setEditMerchantId(r.merchant!.id)}
                        />
                      )}
                      {r.purchase && (
                        <span className="tx-meta tx-meta--purchase">
                          <ShoppingBag size={12} aria-hidden />
                          <button
                            type="button"
                            className="tx-meta__text flag-editable"
                            title="Voir / modifier l'achat"
                            onClick={() => setEditPurchaseId(r.purchase!.id)}
                            style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit" }}
                          >
                            {r.purchase.name}
                          </button>
                          {occurrenceLabel(r.purchase) && (
                            <span className="tx-meta__mono">{occurrenceLabel(r.purchase)}</span>
                          )}
                          <button
                            type="button"
                            aria-label="Détacher l'achat"
                            className="tx-meta__x"
                            onClick={() => handlers.onDetachPurchase(r.key)}
                          >
                            <X size={11} aria-hidden />
                          </button>
                        </span>
                      )}
                      {r.recurring && (
                        <span className="tx-meta tx-meta--recurring">
                          <Repeat size={12} aria-hidden />
                          <button
                            type="button"
                            className="tx-meta__text flag-editable"
                            title="Modifier la récurrente"
                            onClick={() => setEditRecurringId(r.recurring!.id)}
                            style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit" }}
                          >
                            {r.recurring.name}
                          </button>
                          {handlers.onDetachRecurring && (
                            <button
                              type="button"
                              aria-label="Détacher la récurrence"
                              className="tx-meta__x"
                              onClick={() => handlers.onDetachRecurring!(r.key)}
                            >
                              <X size={11} aria-hidden />
                            </button>
                          )}
                        </span>
                      )}
                      {r.personsBadge && r.personsBadge.count > 0 && (
                        <button
                          type="button"
                          className="tx-meta tx-meta--persons"
                          onClick={() => setPersonKey(r.key)}
                        >
                          <Users size={12} aria-hidden />
                          <span className="tx-meta__text">
                            {r.personsBadge.count} personne{r.personsBadge.count > 1 ? "s" : ""} ·{" "}
                            {r.personsBadge.nature === "gift" ? "cadeau" : "dette"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </td>

                {/* — Compte + date mutualisés — */}
                <td data-col="acctdate">
                  <div className="tx-acctdate">
                    {r.account && (
                      <span className="tx-acctdate__account" title={r.account.name}>
                        <Dot color={r.account.color ?? undefined} />
                        <span className="tx-acctdate__name">{r.account.name}</span>
                      </span>
                    )}
                    <span className="tx-acctdate__date">{formatShortDate(r.operationDate)}</span>
                  </div>
                </td>

                {/* — Catégorie — */}
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
                      className="tx-cat tx-cat--btn"
                      onClick={() => setEditing(r.key)}
                      title={cat?.full}
                      data-empty={cat ? undefined : "true"}
                    >
                      {cat ? (
                        <>
                          <span className="badge-dot" style={{ ["--dot-color" as string]: opt?.categoryColor ?? undefined }} aria-hidden />
                          {cat.path && <span className="tx-cat__path">{cat.path} /</span>}
                          <span className="tx-cat__leaf">{cat.leaf}</span>
                        </>
                      ) : (
                        <>
                          <span className="badge-dot badge-dot--empty" aria-hidden />
                          <span className="tx-cat__leaf">Non catégorisée</span>
                        </>
                      )}
                    </button>
                  )}
                </td>

                {/* — Montant + statut — */}
                <td data-col="amount">
                  <div className="tx-amount">
                    <Amount value={r.amount} currency={r.currency} />
                    <span className={`badge-status-${status}`}>
                      {status === "validated" ? "Validée" : status === "ignored" ? "Ignorée" : "À valider"}
                    </span>
                  </div>
                </td>

                {/* — Actions — */}
                <td data-col="actions">
                  <div className="tx-actions">
                    <IconButton
                      label={r.merchant ? "Changer l'enseigne" : "Définir l'enseigne"}
                      data-on={r.merchant ? "true" : undefined}
                      disabled={r.merchant?.locked}
                      onClick={() => setMerchantKey(r.key)}
                    >
                      <Store size={16} />
                    </IconButton>
                    <IconButton
                      label={r.purchase ? "Changer l'achat" : "Rattacher à un achat"}
                      data-on={r.purchase ? "true" : undefined}
                      onClick={() => setPurchaseKey(r.key)}
                    >
                      <ShoppingBag size={16} />
                    </IconButton>
                    <IconButton
                      label={r.recurring ? "Changer la récurrence" : "Associer une récurrence"}
                      data-on={r.recurring ? "true" : undefined}
                      onClick={() => setRecurringKey(r.key)}
                    >
                      <Repeat size={16} />
                    </IconButton>
                    <IconButton
                      label={r.personsBadge ? "Modifier le partage" : "Partager entre personnes"}
                      data-on={r.personsBadge ? "true" : undefined}
                      onClick={() => setPersonKey(r.key)}
                    >
                      <Users size={16} />
                    </IconButton>
                    {status === "validated" || status === "ignored" ? (
                      <IconButton
                        label={status === "validated" ? "Invalider" : "Rétablir"}
                        onClick={() => handlers.onSetStatus(r.key, "pending")}
                      >
                        <RotateCcw size={16} />
                      </IconButton>
                    ) : (
                      <IconButton label="Valider" data-validate onClick={() => handlers.onValidate(r.key)}>
                        <Check size={16} />
                      </IconButton>
                    )}
                    <Link href={`/transactions/${r.key}`} aria-label="Détail / éditer">
                      <IconButton label="Détail / éditer">
                        <Pencil size={16} />
                      </IconButton>
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
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
          if (purchaseKey !== null) handlers.onAttachPurchase(purchaseKey, option, choice);
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

      {personRow ? renderPersonModal(personRow, () => setPersonKey(null)) : null}

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
