"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Check, Ban, Store, ShoppingBag, X } from "lucide-react";
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
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { formatShortDate } from "@/lib/format/date";
import { installmentOccurrence } from "@/lib/purchases/installments";
import {
  validateTransaction,
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
import { deleteRule } from "@/server/actions/rules";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { PurchaseOption, InstallmentChoice } from "@/lib/purchases/types";
import type { MerchantOption } from "@/lib/merchants/types";

type RowOverride = Partial<{
  subcategory_id: string | null;
  merchant: { id: string; name: string } | null;
  purchase: TransactionRow["purchase"];
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
}: {
  rows: TransactionRow[];
  subcategoryOptions: SubcategoryOption[];
  purchaseOptions: PurchaseOption[];
  merchantOptions: MerchantOption[];
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
    const res = await attachTransactionToMerchant(id, option.id);
    if (!res.ok) return toast.error(res.error);
    patch(id, { merchant: { id: option.id, name: option.name } });
    const row = rowById.get(id);

    if (res.merchantCategorized) {
      toast.success(`L'enseigne « ${option.name} » a hérité de la catégorie de la transaction.`);
    }

    // Enseigne sans catégorie et transaction non catégorisée : rien à valider.
    if (!res.subcategoryId) {
      router.refresh();
      toast.info(
        `Enseigne « ${option.name} » rattachée. Définis une catégorie par défaut pour créer une règle automatiquement.`,
      );
      return;
    }
    // Enseigne déjà catégorisée : sa catégorie valide la transaction → elle
    // quitte « à valider ». En cas d'héritage inverse, la transaction garde son
    // statut (elle avait déjà sa catégorie).
    const validated = !res.merchantCategorized;
    if (validated) hide(id);
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
    const prefix = validated ? "Validée · règle" : "Règle";
    toast.success(
      ruleRes.applied > 0
        ? `${prefix} « ${option.name} » créée · ${ruleRes.applied} rattachée${ruleRes.applied > 1 ? "s" : ""}`
        : `${prefix} « ${option.name} » créée`,
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
    const res =
      choice.mode === "existing"
        ? await attachTransactionToInstallment(id, choice.installmentId)
        : choice.mode === "create"
          ? await createInstallmentForTransaction(id, option.id)
          : await attachTransactionToPurchase(id, option.id);
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
    });
    const suffix =
      choice.mode === "existing"
        ? " · échéance remplie"
        : choice.mode === "create"
          ? " · échéance créée"
          : "";
    // La catégorie de l'achat est héritée → transaction validée, elle quitte
    // la liste ; sinon elle reste à valider avec l'achat rattaché.
    if (option.subcategoryId) {
      hide(id);
      router.refresh();
      toast.success(`Validée · rattachée à « ${option.name} »${suffix}`);
    } else {
      router.refresh();
      toast.success(`Rattachée à l'achat « ${option.name} »${suffix}`);
    }
  }

  async function detachPurchase(id: string) {
    const res = await detachTransaction(id);
    if (!res.ok) return toast.error(res.error);
    patch(id, { purchase: null });
    router.refresh();
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
                  <div style={{ fontWeight: "var(--fw-medium)" }}>{row.label}</div>
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
                      if (subId) validate(raw, subId);
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
    </>
  );
}
