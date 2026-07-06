"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Check, Ban, Store, ShoppingBag, X, Repeat, Users, ArrowDownLeft } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Dot } from "@/components/ui/Badge";
import { CategorySelect } from "./CategorySelect";
import { RuleSuggestionForm } from "./RuleSuggestionForm";
import { NoteCell } from "./NoteCell";
import { MerchantAttachModal } from "@/components/import/MerchantAttachModal";
import { PurchaseAttachModal } from "@/components/import/PurchaseAttachModal";
import { RecurringSelect } from "@/components/recurring/RecurringSelect";
import { PersonSharePicker } from "@/components/persons/PersonSharePicker";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { formatShortDate } from "@/lib/format/date";
import { installmentOccurrence } from "@/lib/purchases/installments";
import {
  validateTransaction,
  setTransactionSubcategory,
  setTransactionStatus,
  updateTransactionNote,
} from "@/server/actions/transactions";
import {
  attachTransactionToMerchant,
  detachTransactionFromMerchant,
  addMerchantRule,
} from "@/server/actions/merchants";
import {
  attachTransactionToPurchase,
  attachTransactionToInstallment,
  createInstallmentForTransaction,
  detachTransaction,
} from "@/server/actions/purchases";
import {
  associateTransactionToRecurring,
  createAndAssociateRecurring,
  detachTransactionFromRecurring,
} from "@/server/actions/recurring";
import { getTransactionSplit } from "@/server/actions/persons";
import { deleteRule } from "@/server/actions/rules";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { PurchaseOption, InstallmentChoice } from "@/lib/purchases/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringOption } from "@/lib/recurring/queries";
import type { PersonOption, TransactionSplit } from "@/lib/persons/types";

type RowOverride = Partial<{
  subcategory_id: string | null;
  merchant: { id: string; name: string } | null;
  purchase: TransactionRow["purchase"];
  recurring: TransactionRow["recurring"];
  personsSummary: TransactionRow["personsSummary"];
  note: string | null;
}>;

const chipBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  fontSize: "var(--text-xs)",
  cursor: "pointer",
};

export function PendingValidator({
  rows,
  subcategoryOptions,
  purchaseOptions,
  merchantOptions,
  recurringOptions,
  personOptions,
}: {
  rows: TransactionRow[];
  subcategoryOptions: SubcategoryOption[];
  purchaseOptions: PurchaseOption[];
  merchantOptions: MerchantOption[];
  recurringOptions: RecurringOption[];
  personOptions: PersonOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Record<string, string | null>>(
    Object.fromEntries(rows.map((r) => [r.id, r.subcategory_id])),
  );
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [ruleFor, setRuleFor] = useState<TransactionRow | null>(null);
  const [merchantFor, setMerchantFor] = useState<TransactionRow | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<TransactionRow | null>(null);
  const [recurringFor, setRecurringFor] = useState<TransactionRow | null>(null);
  // Ventilation personnes : chargée à la demande à l'ouverture (non préchargée
  // pour la liste). `loading` porte l'id en cours de chargement.
  const [personsFor, setPersonsFor] = useState<{ row: TransactionRow; split: TransactionSplit } | null>(null);
  const [loadingPersons, setLoadingPersons] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  function hide(id: string) {
    setHidden((h) => new Set(h).add(id));
  }
  function unhide(id: string) {
    setHidden((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });
  }
  function patch(id: string, p: RowOverride) {
    setOverrides((m) => ({ ...m, [id]: { ...m[id], ...p } }));
  }
  function merged(row: TransactionRow): TransactionRow {
    const o = overrides[row.id];
    return o ? { ...row, ...o } : row;
  }

  async function validate(row: TransactionRow, subIdArg?: string | null) {
    const subId = subIdArg ?? selected[row.id] ?? null;
    if (!subId) return toast.error("Choisis une catégorie avant de valider.");
    const res = await runOptimistic({
      apply: () => hide(row.id),
      rollback: () => unhide(row.id),
      run: () => validateTransaction(row.id, subId),
      onError: toast.error,
    });
    if (res.ok) {
      router.refresh();
      if (res.merchantCategorized) {
        toast.success(
          `L'enseigne « ${res.merchantCategorized.name} » n'avait pas de catégorie : elle hérite de celle-ci.`,
        );
      }
      toast.success("Validée", {
        duration: 8000,
        action: { label: "Créer une règle", onClick: () => setRuleFor(row) },
      });
    }
  }

  /**
   * Enregistre la catégorie choisie SANS valider : la transaction reste dans
   * l'onglet « à valider » (édition libre, validation manuelle ensuite).
   */
  async function saveCategory(id: string, subId: string | null) {
    const res = await setTransactionSubcategory(id, subId);
    if (!res.ok) return toast.error(res.error);
    patch(id, { subcategory_id: subId });
    router.refresh();
    if (res.merchantCategorized) {
      toast.success(
        `L'enseigne « ${res.merchantCategorized.name} » a hérité de cette catégorie.`,
      );
    }
  }

  async function ignore(row: TransactionRow) {
    const res = await runOptimistic({
      apply: () => hide(row.id),
      rollback: () => unhide(row.id),
      run: () => setTransactionStatus(row.id, "ignored"),
      onError: toast.error,
    });
    if (res.ok) router.refresh();
  }

  // --- Enseigne ------------------------------------------------------------
  async function attachMerchant(id: string, option: MerchantOption) {
    // Édition sans validation : la catégorie de l'enseigne est héritée mais la
    // transaction reste « à valider ».
    const res = await attachTransactionToMerchant(id, option.id, { validate: false });
    if (!res.ok) return toast.error(res.error);
    // Reflète l'enseigne + la catégorie éventuellement héritée de l'enseigne.
    patch(id, {
      merchant: { id: option.id, name: option.name },
      ...(res.subcategoryId && !res.merchantCategorized
        ? { subcategory_id: res.subcategoryId }
        : {}),
    });
    if (res.subcategoryId && !res.merchantCategorized) {
      setSelected((s) => ({ ...s, [id]: res.subcategoryId }));
    }
    const row = rowById.get(id);

    if (res.merchantCategorized) {
      toast.success(`L'enseigne « ${option.name} » a hérité de la catégorie de la transaction.`);
    }

    // Enseigne sans catégorie et transaction non catégorisée : rien de plus.
    if (!res.subcategoryId) {
      router.refresh();
      toast.info(
        `Enseigne « ${option.name} » rattachée. Définis une catégorie par défaut pour créer une règle automatiquement.`,
      );
      return;
    }
    if (!row) {
      router.refresh();
      return;
    }
    const ruleRes = await addMerchantRule(option.id, {
      pattern: row.label,
      matchType: "contains",
    });
    router.refresh();
    if (!ruleRes.ok) return toast.error(ruleRes.error);
    toast.success(
      ruleRes.applied > 0
        ? `Règle « ${option.name} » créée · ${ruleRes.applied} rattachée${ruleRes.applied > 1 ? "s" : ""}`
        : `Règle « ${option.name} » créée`,
      {
        duration: 10000,
        action: {
          label: "Annuler",
          onClick: async () => {
            await deleteRule(ruleRes.ruleId);
            toast.info("Règle annulée.");
            router.refresh();
          },
        },
      },
    );
  }

  async function detachMerchant(id: string) {
    const res = await detachTransactionFromMerchant(id);
    if (!res.ok) return toast.error(res.error);
    patch(id, { merchant: null });
    router.refresh();
  }

  // --- Achat ---------------------------------------------------------------
  async function attachPurchase(
    id: string,
    option: PurchaseOption,
    choice: InstallmentChoice,
  ) {
    // Édition sans validation : la catégorie de l'achat est héritée mais la
    // transaction reste « à valider ».
    const res =
      choice.mode === "existing"
        ? await attachTransactionToInstallment(id, choice.installmentId, { validate: false })
        : choice.mode === "create"
          ? await createInstallmentForTransaction(id, option.id, { validate: false })
          : await attachTransactionToPurchase(id, option.id, { validate: false });
    if (!res.ok) return toast.error(res.error);
    const row = rowById.get(id);
    const startMonth = option.installmentMonths[0] ?? null;
    const refMonth =
      choice.mode === "existing"
        ? choice.month.slice(0, 7)
        : (row?.operation_date.slice(0, 7) ?? null);
    const total =
      option.installmentMonths.length + (choice.mode === "create" ? 1 : 0);
    patch(id, {
      purchase: {
        id: option.id,
        name: option.name,
        occurrence:
          startMonth && refMonth ? installmentOccurrence(startMonth, refMonth) : null,
        installmentTotal: total,
        endless: option.endless,
      },
      ...(option.merchantId
        ? { merchant: { id: option.merchantId, name: option.merchantName ?? "" } }
        : {}),
      // Catégorie héritée de l'achat (transaction toujours « à valider »).
      ...(option.subcategoryId ? { subcategory_id: option.subcategoryId } : {}),
    });
    if (option.subcategoryId) {
      setSelected((s) => ({ ...s, [id]: option.subcategoryId }));
    }
    const suffix =
      choice.mode === "existing"
        ? " · échéance remplie"
        : choice.mode === "create"
          ? " · échéance créée"
          : "";
    router.refresh();
    toast.success(`Rattachée à l'achat « ${option.name} »${suffix}`);
  }

  async function detachPurchase(id: string) {
    const res = await detachTransaction(id);
    if (!res.ok) return toast.error(res.error);
    // La catégorie était héritée de l'achat : on la vide (la transaction reste
    // « à valider » dans cette vue).
    patch(id, { purchase: null, subcategory_id: null });
    setSelected((m) => ({ ...m, [id]: null }));
    router.refresh();
  }

  // --- Récurrente ----------------------------------------------------------
  // Association sans validation : la transaction reste « à valider ».
  async function associateRecurring(id: string, recurringId: string) {
    const res = await associateTransactionToRecurring(id, recurringId, { validate: false });
    if (!res.ok) return toast.error(res.error);
    const opt = recurringOptions.find((r) => r.id === recurringId);
    const name = opt?.name ?? "";
    const patchObj: RowOverride = { recurring: { id: recurringId, name } };
    // Le modèle impose sa catégorie aux transactions encore non catégorisées et
    // son enseigne à toutes — on le reflète (sans valider).
    const row = rowById.get(id);
    const currentSub = selected[id] ?? row?.subcategory_id ?? null;
    if (opt?.subcategoryId && !currentSub) {
      patchObj.subcategory_id = opt.subcategoryId;
      setSelected((s) => ({ ...s, [id]: opt.subcategoryId }));
    }
    if (opt?.merchantId) {
      patchObj.merchant = { id: opt.merchantId, name: opt.merchantName ?? "" };
    }
    patch(id, patchObj);
    setRecurringFor(null);
    router.refresh();
    toast.success(`Associée à « ${name} »`);
  }

  async function createRecurringForTx(id: string, name: string) {
    const row = rowById.get(id);
    if (!row) return;
    const res = await createAndAssociateRecurring(
      { name, rawLabel: row.raw_label, amount: row.amount },
      { validate: false },
    );
    if (!res.ok) return toast.error(res.error);
    patch(id, { recurring: { id: res.id, name } });
    setRecurringFor(null);
    router.refresh();
    toast.success(`Récurrente « ${name} » créée`);
  }

  async function detachRecurring(id: string) {
    const res = await detachTransactionFromRecurring(id);
    if (!res.ok) return toast.error(res.error);
    patch(id, { recurring: null });
    router.refresh();
  }

  // --- Personnes -----------------------------------------------------------
  async function openPersons(row: TransactionRow) {
    setLoadingPersons(row.id);
    const split = await getTransactionSplit(row.id);
    setLoadingPersons(null);
    setPersonsFor({ row, split });
  }

  // --- Note ----------------------------------------------------------------
  async function saveNote(id: string, note: string) {
    const res = await updateTransactionNote(id, note);
    if (!res.ok) return toast.error(res.error);
    patch(id, { note: note.trim() ? note.trim() : null });
    router.refresh();
    toast.success("Note enregistrée");
  }

  const visibleRows = rows.filter((r) => !hidden.has(r.id));

  if (visibleRows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Check}
          title="Rien à valider"
          description="Toutes tes transactions sont catégorisées. Beau travail !"
        />
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {visibleRows.map((raw) => {
          const row = merged(raw);
          const purchase = row.purchase;
          return (
            <div className="card-pending-validator" key={row.id}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <code className="tx-label-code">{row.label}</code>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", display: "flex", gap: "var(--space-2)", alignItems: "center", marginTop: "var(--space-1)" }}>
                    <span>{formatShortDate(row.operation_date)}</span>
                    {row.account && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
                        <Dot color={row.account.color ?? undefined} />
                        {row.account.name}
                      </span>
                    )}
                  </div>
                </div>
                <Amount value={row.amount} currency={row.currency} size="lg" />
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ minWidth: 240, flex: 1 }}>
                  <CategorySelect
                    value={selected[row.id] ?? null}
                    options={subcategoryOptions}
                    allowCreate
                    onChange={(subId) => {
                      setSelected((s) => ({ ...s, [row.id]: subId }));
                      saveCategory(row.id, subId);
                    }}
                  />
                </div>
                <Button size="sm" leftIcon={<Check size={14} />} onClick={() => validate(raw)}>
                  Valider
                </Button>
                <Button variant="ghost" size="sm" leftIcon={<Wand2 size={14} />} onClick={() => setRuleFor(raw)}>
                  Créer une règle
                </Button>
                <Button variant="ghost" size="sm" leftIcon={<Ban size={14} />} onClick={() => ignore(raw)}>
                  Ignorer
                </Button>
              </div>

              {/* Enseigne · Achat · Note */}
              <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)" }}>
                {row.merchant ? (
                  <span style={{ ...chipBtn, cursor: "default", color: "var(--color-text-secondary)" }}>
                    <Store size={13} aria-hidden />
                    {row.merchant.name}
                    <button
                      type="button"
                      aria-label="Détacher l'enseigne"
                      onClick={() => detachMerchant(row.id)}
                      style={{ ...chipBtn, color: "var(--color-text-muted)" }}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMerchantFor(raw)}
                    style={{ ...chipBtn, color: "var(--color-text-muted)" }}
                  >
                    <Store size={13} aria-hidden />
                    Enseigne…
                  </button>
                )}

                {purchase ? (
                  <span style={{ ...chipBtn, cursor: "default", color: "var(--color-brand-primary-600)" }}>
                    <ShoppingBag size={13} aria-hidden />
                    {purchase.name}
                    {(() => {
                      const total = purchase.installmentTotal ?? 0;
                      if (purchase.occurrence == null || (!purchase.endless && total <= 1)) return null;
                      return (
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                          {purchase.occurrence}/{purchase.endless ? "∞" : total}
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      aria-label="Détacher l'achat"
                      onClick={() => detachPurchase(row.id)}
                      style={{ ...chipBtn, color: "var(--color-text-muted)" }}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPurchaseFor(raw)}
                    style={{ ...chipBtn, color: "var(--color-text-muted)" }}
                  >
                    <ShoppingBag size={13} aria-hidden />
                    Achat…
                  </button>
                )}

                {row.recurring ? (
                  <span style={{ ...chipBtn, cursor: "default", color: "var(--color-text-secondary)" }}>
                    <Repeat size={13} aria-hidden />
                    {row.recurring.name}
                    <button
                      type="button"
                      aria-label="Détacher la récurrente"
                      onClick={() => detachRecurring(row.id)}
                      style={{ ...chipBtn, color: "var(--color-text-muted)" }}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRecurringFor(raw)}
                    style={{ ...chipBtn, color: "var(--color-text-muted)" }}
                  >
                    <Repeat size={13} aria-hidden />
                    Récurrente…
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openPersons(raw)}
                  disabled={loadingPersons === row.id}
                  style={{
                    ...chipBtn,
                    color: row.repayment
                      ? "var(--color-success)"
                      : row.personsSummary
                        ? "var(--color-text-secondary)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {row.repayment ? (
                    <ArrowDownLeft size={13} aria-hidden />
                  ) : (
                    <Users size={13} aria-hidden />
                  )}
                  {row.repayment
                    ? `Remboursement · ${row.repayment.personName}`
                    : row.personsSummary
                      ? `${row.personsSummary.count} personne${row.personsSummary.count > 1 ? "s" : ""}`
                      : "Personnes…"}
                </button>

                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: row.note ? "var(--color-text-secondary)" : "var(--color-text-muted)" }}>
                  <NoteCell note={row.note} onSave={(v) => saveNote(row.id, v)} />
                  {row.note ? "Note" : "Note…"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={ruleFor !== null}
        onClose={() => setRuleFor(null)}
        title="Créer une règle depuis ce libellé"
        variantClass="modal-surface"
      >
        {ruleFor && (
          <RuleSuggestionForm
            transactionId={ruleFor.id}
            rawLabel={ruleFor.raw_label}
            accountId={ruleFor.account?.id ?? ""}
            defaultSubcategoryId={selected[ruleFor.id] ?? null}
            subcategoryOptions={subcategoryOptions}
            merchantId={ruleFor.merchant?.id ?? null}
            merchantName={ruleFor.merchant?.name ?? null}
            onDone={() => setRuleFor(null)}
          />
        )}
      </Modal>

      <MerchantAttachModal
        open={merchantFor !== null}
        onClose={() => setMerchantFor(null)}
        merchantOptions={merchantOptions}
        defaultSubcategoryId={
          merchantFor ? (selected[merchantFor.id] ?? merchantFor.subcategory_id) : null
        }
        onAttach={(option) => {
          if (merchantFor) attachMerchant(merchantFor.id, option);
        }}
      />

      <PurchaseAttachModal
        open={purchaseFor !== null}
        onClose={() => setPurchaseFor(null)}
        purchaseOptions={purchaseOptions}
        fromTransaction={
          purchaseFor
            ? {
                operationDate: purchaseFor.operation_date,
                amount: purchaseFor.amount,
                label: purchaseFor.label,
              }
            : null
        }
        onAttach={(option, choice) => {
          if (purchaseFor) attachPurchase(purchaseFor.id, option, choice);
        }}
      />

      <Modal
        open={recurringFor !== null}
        onClose={() => setRecurringFor(null)}
        title="Associer à une récurrente"
      >
        {recurringFor && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <RecurringSelect
              value={null}
              options={recurringOptions}
              onChange={(rid) => {
                if (rid) associateRecurring(recurringFor.id, rid);
              }}
              onCreate={(name) => createRecurringForTx(recurringFor.id, name)}
            />
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              La transaction reste « à valider » : l&apos;association n&apos;entraîne pas de
              validation automatique.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={personsFor !== null}
        onClose={() => setPersonsFor(null)}
        title="Partage entre personnes"
      >
        {personsFor && (
          <PersonSharePicker
            transactionId={personsFor.row.id}
            amount={personsFor.row.amount}
            currency={personsFor.row.currency}
            persons={personOptions}
            initial={personsFor.split}
            onSaved={() => setPersonsFor(null)}
          />
        )}
      </Modal>
    </>
  );
}
