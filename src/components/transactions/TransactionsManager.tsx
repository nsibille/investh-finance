"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Check, Ban, Pencil } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  TransactionEditorTable,
  type EditorRowVM,
  type EditorHandlers,
} from "./TransactionEditorTable";
import { RuleSuggestionForm } from "./RuleSuggestionForm";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import {
  setTransactionSubcategory,
  setTransactionStatus,
  validateTransaction,
  updateTransactionNote,
} from "@/server/actions/transactions";
import { createCategoryOnTheFly } from "@/server/actions/categories";
import {
  attachTransactionToPurchase,
  attachTransactionToInstallment,
  createInstallmentForTransaction,
  detachTransaction,
} from "@/server/actions/purchases";
import {
  attachTransactionToMerchant,
  detachTransactionFromMerchant,
  addMerchantRule,
} from "@/server/actions/merchants";
import { deleteRule } from "@/server/actions/rules";
import { installmentOccurrence } from "@/lib/purchases/installments";
import {
  associateTransactionToRecurring,
  undoAssociateRecurring,
  detachTransactionFromRecurring,
  createAndAssociateRecurring,
  deleteRecurringPattern,
} from "@/server/actions/recurring";
import {
  setTransactionShares,
  clearTransactionShares,
} from "@/server/actions/persons";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { PurchaseOption, InstallmentChoice } from "@/lib/purchases/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringOption } from "@/lib/recurring/queries";
import type { PersonOption, SplitNature } from "@/lib/persons/types";

/** Répartit `total` en `n` parts égales (reste au centime sur la 1re part). */
function equalShares(total: number, n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor((total / n) * 100) / 100;
  const parts = new Array(n).fill(each);
  parts[0] = Math.round((total - each * (n - 1)) * 100) / 100;
  return parts;
}

type RowOverride = Partial<{
  subcategory_id: string | null;
  status: TransactionRow["status"];
  note: string | null;
  purchase: TransactionRow["purchase"];
  merchant: { id: string; name: string } | null;
  recurring: { id: string; name: string } | null;
  personsSummary: { count: number; nature: SplitNature } | null;
}>;

export function TransactionsManager({
  rows,
  total,
  page,
  perPage,
  subcategoryOptions,
  purchaseOptions,
  merchantOptions,
  recurringOptions,
  personOptions,
}: {
  rows: TransactionRow[];
  total: number;
  page: number;
  perPage: number;
  subcategoryOptions: SubcategoryOption[];
  purchaseOptions: PurchaseOption[];
  merchantOptions: MerchantOption[];
  recurringOptions: RecurringOption[];
  personOptions: PersonOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [extraOptions, setExtraOptions] = useState<SubcategoryOption[]>([]);
  const [ruleFor, setRuleFor] = useState<TransactionRow | null>(null);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const allOptions = useMemo(() => {
    if (extraOptions.length === 0) return subcategoryOptions;
    const seen = new Set(subcategoryOptions.map((o) => o.id));
    return [...subcategoryOptions, ...extraOptions.filter((o) => !seen.has(o.id))];
  }, [subcategoryOptions, extraOptions]);

  function merged(row: TransactionRow): TransactionRow {
    const o = overrides[row.id];
    return o ? { ...row, ...o } : row;
  }
  function patch(id: string, p: RowOverride) {
    setOverrides((m) => ({ ...m, [id]: { ...m[id], ...p } }));
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  // --- Catégorie -----------------------------------------------------------
  async function assignCategory(id: string, subId: string | null) {
    const row = rowById.get(id);
    if (!row) return;
    const cur = merged(row);
    const prevSub = cur.subcategory_id;
    if (!subId) {
      const res = await runOptimistic({
        apply: () => patch(id, { subcategory_id: null }),
        rollback: () => patch(id, { subcategory_id: prevSub }),
        run: () => setTransactionSubcategory(id, null),
        onError: toast.error,
      });
      if (res.ok) router.refresh();
      return;
    }
    const prevStatus = cur.status;
    const res = await runOptimistic({
      apply: () => patch(id, { subcategory_id: subId, status: "validated" }),
      rollback: () => patch(id, { subcategory_id: prevSub, status: prevStatus }),
      run: () => validateTransaction(id, subId),
      onError: toast.error,
    });
    if (res.ok) {
      router.refresh();
      toast.success("Validée", {
        duration: 8000,
        action: {
          label: "Créer une règle",
          onClick: () => setRuleFor({ ...row, subcategory_id: subId }),
        },
      });
    }
  }

  async function createCategory(id: string, name: string) {
    const res = await createCategoryOnTheFly(name);
    if (!res.ok) return toast.error(res.error);
    setExtraOptions((prev) => [
      ...prev,
      {
        id: res.subcategoryId,
        label: res.label,
        categoryColor: res.categoryColor,
        typeName: res.typeName,
        categoryName: res.categoryName,
        subName: null,
      },
    ]);
    await assignCategory(id, res.subcategoryId);
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
    // Occurrence : mois de l'échéance remplie, sinon mois de l'opération.
    const refMonth =
      choice.mode === "existing"
        ? choice.month.slice(0, 7)
        : (row?.operation_date.slice(0, 7) ?? null);
    // Créer une échéance ajoute une ligne à l'échéancier.
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
      ...(option.subcategoryId
        ? { subcategory_id: option.subcategoryId, status: "validated" as const }
        : {}),
      ...(option.merchantId
        ? { merchant: { id: option.merchantId, name: option.merchantName ?? "" } }
        : {}),
    });
    router.refresh();
    const suffix =
      choice.mode === "existing"
        ? " · échéance remplie"
        : choice.mode === "create"
          ? " · échéance créée"
          : "";
    toast.success(`Rattachée à l'achat « ${option.name} »${suffix}`);
  }

  async function detachPurchase(id: string) {
    const res = await detachTransaction(id);
    if (!res.ok) return toast.error(res.error);
    patch(id, { purchase: null });
    router.refresh();
  }

  // --- Enseigne ------------------------------------------------------------
  async function attachMerchant(id: string, option: MerchantOption) {
    const res = await attachTransactionToMerchant(id, option.id);
    if (!res.ok) return toast.error(res.error);
    patch(id, {
      merchant: { id: option.id, name: option.name },
      ...(option.subcategoryId
        ? { subcategory_id: option.subcategoryId, status: "validated" as const }
        : {}),
    });
    router.refresh();
    const row = rowById.get(id);
    if (!option.subcategoryId) {
      toast.info(
        `Enseigne « ${option.name} » rattachée. Définis une catégorie par défaut pour créer une règle automatiquement.`,
      );
      return;
    }
    if (!row) return;
    const ruleRes = await addMerchantRule(option.id, {
      pattern: row.label,
      matchType: "contains",
    });
    if (!ruleRes.ok) return toast.error(ruleRes.error);
    toast.success(
      ruleRes.applied > 0
        ? `Règle créée pour « ${option.name} » · ${ruleRes.applied} transaction${ruleRes.applied > 1 ? "s" : ""} rattachée${ruleRes.applied > 1 ? "s" : ""}`
        : `Règle créée pour « ${option.name} »`,
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

  // --- Récurrente ----------------------------------------------------------
  async function attachRecurring(id: string, option: RecurringOption) {
    const res = await associateTransactionToRecurring(id, option.id);
    if (!res.ok) return toast.error(res.error);
    patch(id, {
      recurring: { id: option.id, name: option.name },
      ...(option.subcategoryId ? { subcategory_id: option.subcategoryId } : {}),
      ...(option.merchantId
        ? { merchant: { id: option.merchantId, name: option.merchantName ?? "" } }
        : {}),
    });
    router.refresh();
    toast.success(
      res.applied > 0
        ? `Rattachée à « ${option.name} » · ${res.applied} transaction${res.applied > 1 ? "s" : ""} au total`
        : `Rattachée à « ${option.name} »`,
      {
        duration: 10000,
        action: {
          label: "Annuler",
          onClick: async () => {
            await undoAssociateRecurring(option.id, res.addedLabel, res.addedAmount, res.ids);
            patch(id, { recurring: null });
            toast.info("Association annulée.");
            router.refresh();
          },
        },
      },
    );
  }

  async function createRecurring(id: string, name: string) {
    const row = rowById.get(id);
    if (!row) return;
    const res = await createAndAssociateRecurring({
      name,
      rawLabel: row.raw_label,
      amount: row.amount,
    });
    if (!res.ok) return toast.error(res.error);
    patch(id, { recurring: { id: res.id, name } });
    router.refresh();
    toast.success(
      res.applied > 0
        ? `Récurrente « ${name} » créée · ${res.applied} transaction${res.applied > 1 ? "s" : ""} rattachée${res.applied > 1 ? "s" : ""}`
        : `Récurrente « ${name} » créée`,
      {
        duration: 10000,
        action: {
          label: "Annuler",
          onClick: async () => {
            await deleteRecurringPattern(res.id);
            patch(id, { recurring: null });
            toast.info("Récurrente supprimée.");
            router.refresh();
          },
        },
      },
    );
  }

  async function detachRecurring(id: string) {
    const res = await detachTransactionFromRecurring(id);
    if (!res.ok) return toast.error(res.error);
    patch(id, { recurring: null });
    router.refresh();
  }

  // --- Partage entre personnes --------------------------------------------
  async function sharePersons(
    id: string,
    value: { nature: SplitNature; personIds: string[] } | null,
  ) {
    const row = rowById.get(id);
    if (!row) return;
    if (!value || value.personIds.length === 0) {
      const res = await clearTransactionShares(id);
      if (!res.ok) return toast.error(res.error);
      patch(id, { personsSummary: null });
      router.refresh();
      return;
    }
    const parts = equalShares(Math.abs(row.amount), value.personIds.length);
    const res = await setTransactionShares(id, {
      nature: value.nature,
      shares: value.personIds.map((personId, k) => ({ personId, amount: parts[k] })),
    });
    if (!res.ok) return toast.error(res.error);
    patch(id, {
      personsSummary: { count: value.personIds.length, nature: value.nature },
    });
    router.refresh();
    toast.success(
      `Partagée avec ${value.personIds.length} personne${value.personIds.length > 1 ? "s" : ""}`,
    );
  }

  // --- Note ----------------------------------------------------------------
  async function saveNote(id: string, note: string) {
    const res = await updateTransactionNote(id, note);
    if (!res.ok) return toast.error(res.error);
    patch(id, { note: note.trim() ? note.trim() : null });
    router.refresh();
    toast.success("Note enregistrée");
  }

  // --- Statut --------------------------------------------------------------
  async function quickValidate(id: string) {
    const row = rowById.get(id);
    if (!row) return;
    const cur = merged(row);
    if (!cur.subcategory_id) {
      return toast.error("Choisis une catégorie avant de valider.");
    }
    const prev = cur.status;
    const res = await runOptimistic({
      apply: () => patch(id, { status: "validated" }),
      rollback: () => patch(id, { status: prev }),
      run: () => validateTransaction(id, cur.subcategory_id),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success("Transaction validée");
      router.refresh();
    }
  }

  async function ignore(id: string) {
    const row = rowById.get(id);
    if (!row) return;
    const prev = merged(row).status;
    const res = await runOptimistic({
      apply: () => patch(id, { status: "ignored" }),
      rollback: () => patch(id, { status: prev }),
      run: () => setTransactionStatus(id, "ignored"),
      onError: toast.error,
    });
    if (res.ok) router.refresh();
  }

  const handlers: EditorHandlers = {
    onAssignCategory: assignCategory,
    onCreateCategory: createCategory,
    onAttachPurchase: attachPurchase,
    onDetachPurchase: detachPurchase,
    onAttachMerchant: attachMerchant,
    onDetachMerchant: detachMerchant,
    onAttachRecurring: attachRecurring,
    onCreateRecurring: createRecurring,
    onDetachRecurring: detachRecurring,
    onSharePersons: sharePersons,
    onSaveNote: saveNote,
  };

  const editorRows: EditorRowVM[] = rows.map((row) => {
    const r = merged(row);
    return {
      key: row.id,
      operationDate: row.operation_date,
      account: row.account
        ? { name: row.account.name, color: row.account.color }
        : null,
      label: row.label,
      amount: row.amount,
      currency: row.currency,
      categoryId: r.subcategory_id,
      categoryLocked: Boolean(r.purchase),
      purchase: r.purchase
        ? {
            id: r.purchase.id,
            name: r.purchase.name,
            occurrence: r.purchase.occurrence ?? null,
            installmentTotal: r.purchase.installmentTotal ?? null,
            endless: r.purchase.endless ?? false,
          }
        : null,
      merchant: r.merchant ?? null,
      recurring: r.recurring ?? null,
      personsBadge: r.personsSummary ?? null,
      personsInitial: null,
      note: r.note,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <TransactionEditorTable
        rows={editorRows}
        handlers={handlers}
        subcategoryOptions={allOptions}
        purchaseOptions={purchaseOptions}
        merchantOptions={merchantOptions}
        recurringOptions={recurringOptions}
        personOptions={personOptions}
        showAccount
        trailingHeader={<th style={{ width: 176 }}>Statut</th>}
        renderTrailing={(vm) => {
          const row = rowById.get(vm.key);
          if (!row) return null;
          const r = merged(row);
          return (
            <td>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", justifyContent: "space-between" }}>
                <StatusBadge status={r.status} />
                <div style={{ display: "flex", gap: "var(--space-1)" }}>
                  {r.status === "pending" && (
                    <IconButton label="Valider" onClick={() => quickValidate(row.id)}>
                      <Check size={16} />
                    </IconButton>
                  )}
                  {r.status !== "ignored" && (
                    <IconButton label="Ignorer" onClick={() => ignore(row.id)}>
                      <Ban size={16} />
                    </IconButton>
                  )}
                  <Link href={`/transactions/${row.id}`}>
                    <IconButton label="Détails"><Pencil size={16} /></IconButton>
                  </Link>
                </div>
              </div>
            </td>
          );
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "var(--space-4)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
        }}
      >
        <span>
          {total} transaction{total > 1 ? "s" : ""} · page {page}/{totalPages}
        </span>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            Précédent
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
            Suivant
          </Button>
        </div>
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
            defaultSubcategoryId={ruleFor.subcategory_id}
            subcategoryOptions={allOptions}
            onDone={() => setRuleFor(null)}
          />
        )}
      </Modal>
    </>
  );
}
