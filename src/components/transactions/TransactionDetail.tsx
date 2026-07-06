"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Ban, RotateCcw, Wand2, ShoppingBag, Store, Repeat, Unlink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Amount } from "@/components/ui/Amount";
import { StatusBadge, Dot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { CategorySelect } from "./CategorySelect";
import { MerchantSelect } from "@/components/merchants/MerchantSelect";
import { RecurringSelect } from "@/components/recurring/RecurringSelect";
import { RuleSuggestionForm } from "./RuleSuggestionForm";
import { TagPicker } from "@/components/tags/TagPicker";
import { PersonSharePicker } from "@/components/persons/PersonSharePicker";
import { AttachmentManager } from "@/components/attachments/AttachmentManager";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { formatShortDate } from "@/lib/format/date";
import {
  setTransactionSubcategory,
  setTransactionStatus,
  validateTransaction,
  updateTransactionNote,
} from "@/server/actions/transactions";
import { detachTransaction } from "@/server/actions/purchases";
import {
  attachTransactionToMerchant,
  detachTransactionFromMerchant,
  addMerchantRule,
} from "@/server/actions/merchants";
import { deleteRule } from "@/server/actions/rules";
import {
  associateTransactionToRecurring,
  undoAssociateRecurring,
  detachTransactionFromRecurring,
  createAndAssociateRecurring,
  deleteRecurringPattern,
} from "@/server/actions/recurring";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringOption } from "@/lib/recurring/queries";
import type { Tag } from "@/lib/tags/queries";
import type { AttachmentView } from "@/lib/attachments/types";
import type { PersonOption, TransactionSplit } from "@/lib/persons/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
        {label}
      </span>
      <span style={{ fontSize: "var(--text-sm)" }}>{children}</span>
    </div>
  );
}

export function TransactionDetail({
  tx,
  subcategoryOptions,
  merchantOptions,
  recurringOptions,
  tags,
  allTags,
  attachments,
  personOptions,
  split,
}: {
  tx: TransactionRow;
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  recurringOptions: RecurringOption[];
  tags: Tag[];
  allTags: Tag[];
  attachments: AttachmentView[];
  personOptions: PersonOption[];
  split: TransactionSplit;
}) {
  const router = useRouter();
  const toast = useToast();
  const [subcategoryId, setSubcategoryId] = useState(tx.subcategory_id);
  const [attachingMerchant, setAttachingMerchant] = useState(false);
  const [associatingRec, setAssociatingRec] = useState(false);
  const [status, setStatus] = useState(tx.status);
  const [note, setNote] = useState(tx.note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  // Enseigne à rattacher par la règle créée (null = règle de catégorie simple).
  const [ruleMerchant, setRuleMerchant] = useState<{ id: string; name: string } | null>(null);

  function openRule(merchant: { id: string; name: string } | null) {
    setRuleMerchant(merchant);
    setRuleOpen(true);
  }

  async function changeCategory(subId: string | null) {
    const prev = subcategoryId;
    const res = await runOptimistic({
      apply: () => setSubcategoryId(subId),
      rollback: () => setSubcategoryId(prev),
      run: () => setTransactionSubcategory(tx.id, subId),
      onError: toast.error,
    });
    if (res.ok) {
      router.refresh();
      if (res.merchantCategorized) {
        toast.success(
          `L'enseigne « ${res.merchantCategorized.name} » n'avait pas de catégorie : elle hérite de celle-ci.`,
        );
      }
      if (subId) {
        toast.info("Catégorie mise à jour", {
          duration: 8000,
          action: { label: "Créer une règle", onClick: () => openRule(null) },
        });
      }
    }
  }

  async function changeStatus(next: "pending" | "validated" | "ignored") {
    if (next === "validated" && !subcategoryId) {
      return toast.error("Choisis une catégorie avant de valider.");
    }
    const prev = status;
    const res = await runOptimistic({
      apply: () => setStatus(next),
      rollback: () => setStatus(prev),
      run: () =>
        next === "validated"
          ? validateTransaction(tx.id, subcategoryId)
          : setTransactionStatus(tx.id, next),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success("Statut mis à jour");
      router.refresh();
    }
  }

  async function detach() {
    const res = await detachTransaction(tx.id);
    if (!res.ok) return toast.error(res.error);
    // La catégorie était héritée de l'achat : on la vide et on repasse la
    // transaction « à valider » (miroir de `detachTransaction`).
    setSubcategoryId(null);
    setStatus("pending");
    toast.success("Transaction détachée de l'achat");
    router.refresh();
  }

  async function attachMerchant(merchantId: string) {
    if (!merchantId) return;
    setAttachingMerchant(true);
    const res = await attachTransactionToMerchant(tx.id, merchantId);
    setAttachingMerchant(false);
    if (!res.ok) return toast.error(res.error);
    const name = merchantOptions.find((m) => m.id === merchantId)?.name ?? "l'enseigne";
    // Enseigne déjà catégorisée : sa catégorie vient d'être appliquée à la
    // transaction côté serveur — on reflète l'état localement.
    if (res.subcategoryId && !res.merchantCategorized) setSubcategoryId(res.subcategoryId);
    router.refresh();

    if (res.merchantCategorized) {
      toast.success(`L'enseigne « ${name} » a hérité de la catégorie de la transaction.`);
    }

    // Règle créée automatiquement (comme pour les catégories), avec annulation.
    if (!res.subcategoryId) {
      toast.info(
        "Enseigne rattachée. Définis une catégorie par défaut pour créer une règle automatiquement.",
      );
      return;
    }
    const ruleRes = await addMerchantRule(merchantId, {
      pattern: tx.label,
      matchType: "contains",
    });
    if (!ruleRes.ok) return toast.error(ruleRes.error);
    toast.success(
      ruleRes.applied > 0
        ? `Règle créée pour « ${name} » · ${ruleRes.applied} transaction${ruleRes.applied > 1 ? "s" : ""} rattachée${ruleRes.applied > 1 ? "s" : ""}`
        : `Règle créée pour « ${name} »`,
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

  async function detachMerchant() {
    setAttachingMerchant(true);
    const res = await detachTransactionFromMerchant(tx.id);
    setAttachingMerchant(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Enseigne détachée");
    router.refresh();
  }

  async function associateRecurring(recurringId: string) {
    if (!recurringId) return;
    setAssociatingRec(true);
    const res = await associateTransactionToRecurring(tx.id, recurringId);
    setAssociatingRec(false);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
    const name = recurringOptions.find((r) => r.id === recurringId)?.name ?? "";
    toast.success(
      res.applied > 0
        ? `Rattachée à « ${name} » · ${res.applied} transaction${res.applied > 1 ? "s" : ""} au total`
        : `Rattachée à « ${name} »`,
      {
        duration: 10000,
        action: {
          label: "Annuler",
          onClick: async () => {
            await undoAssociateRecurring(recurringId, res.addedLabel, res.addedAmount, res.ids);
            toast.info("Association annulée.");
            router.refresh();
          },
        },
      },
    );
  }

  async function detachRecurring() {
    setAssociatingRec(true);
    const res = await detachTransactionFromRecurring(tx.id);
    setAssociatingRec(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Détachée de la récurrente");
    router.refresh();
  }

  async function createRecurringForTx(name: string) {
    setAssociatingRec(true);
    const res = await createAndAssociateRecurring({
      name,
      rawLabel: tx.raw_label,
      amount: tx.amount,
    });
    setAssociatingRec(false);
    if (!res.ok) return toast.error(res.error);
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
            toast.info("Récurrente supprimée.");
            router.refresh();
          },
        },
      },
    );
  }

  async function saveNote() {
    setSavingNote(true);
    const res = await updateTransactionNote(tx.id, note);
    setSavingNote(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Note enregistrée");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)", gridTemplateColumns: "1fr", maxWidth: 720 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
          <div>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: "var(--fw-semibold)" }}>{tx.label}</div>
            <div style={{ marginTop: "var(--space-2)" }}><StatusBadge status={status} /></div>
          </div>
          <Amount value={tx.amount} currency={tx.currency} size="xl" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
          <Field label="Date d'opération">{formatShortDate(tx.operation_date)}</Field>
          {tx.value_date && <Field label="Date de valeur">{formatShortDate(tx.value_date)}</Field>}
          <Field label="Compte">
            {tx.account && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Dot color={tx.account.color ?? undefined} />
                {tx.account.name}
              </span>
            )}
          </Field>
        </div>

        <FormField label="Libellé brut">
          <div style={{ padding: "var(--space-3)", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
            {tx.raw_label}
          </div>
        </FormField>
      </Card>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {tx.purchase ? (
            <FormField label="Catégorie (héritée de l'achat)">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <CategorySelect value={subcategoryId} options={subcategoryOptions} disabled onChange={changeCategory} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-2)",
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--color-bg-subtle)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <ShoppingBag size={15} aria-hidden />
                    Rattachée à l&apos;achat « {tx.purchase.name} »
                  </span>
                  <Button variant="ghost" size="sm" leftIcon={<Unlink size={14} />} onClick={detach}>
                    Détacher
                  </Button>
                </div>
              </div>
            </FormField>
          ) : (
            <FormField label="Catégorie">
              <CategorySelect value={subcategoryId} options={subcategoryOptions} allowCreate onChange={changeCategory} />
            </FormField>
          )}

          <FormField label="Enseigne">
            {tx.merchant ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--color-bg-subtle)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-sm)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Store size={15} aria-hidden />
                  {tx.merchant.name}
                </span>
                <Button variant="ghost" size="sm" leftIcon={<Unlink size={14} />} disabled={attachingMerchant} onClick={detachMerchant}>
                  Détacher
                </Button>
              </div>
            ) : (
              <MerchantSelect
                value={null}
                options={merchantOptions}
                placeholder="Rattacher à une enseigne…"
                defaultSubcategoryId={subcategoryId}
                onChange={(id) => {
                  if (id) attachMerchant(id);
                }}
              />
            )}
          </FormField>

          <FormField label="Récurrente">
            {tx.recurring ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--color-bg-subtle)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-sm)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Repeat size={15} aria-hidden />
                  {tx.recurring.name}
                </span>
                <Button variant="ghost" size="sm" leftIcon={<Unlink size={14} />} disabled={associatingRec} onClick={detachRecurring}>
                  Détacher
                </Button>
              </div>
            ) : (
              <RecurringSelect
                value={null}
                options={recurringOptions}
                placeholder="Associer à une récurrente…"
                onChange={(id) => {
                  if (id) associateRecurring(id);
                }}
                onCreate={createRecurringForTx}
              />
            )}
          </FormField>

          <FormField label="Tags">
            <TagPicker transactionId={tx.id} tags={tags} allTags={allTags} />
          </FormField>

          <FormField label="Partage entre personnes">
            <PersonSharePicker
              transactionId={tx.id}
              amount={tx.amount}
              currency={tx.currency}
              persons={personOptions}
              initial={split}
            />
          </FormField>

          <FormField label="Justificatifs">
            <AttachmentManager transactionId={tx.id} attachments={attachments} />
          </FormField>

          <FormField label="Note">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajoute une note…" />
          </FormField>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" size="sm" loading={savingNote} onClick={saveNote}>
              Enregistrer la note
            </Button>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
            {status !== "validated" && (
              <Button leftIcon={<Check size={16} />} onClick={() => changeStatus("validated")}>
                Valider
              </Button>
            )}
            {status !== "ignored" && (
              <Button variant="secondary" leftIcon={<Ban size={16} />} onClick={() => changeStatus("ignored")}>
                Ignorer
              </Button>
            )}
            {status !== "pending" && (
              <Button variant="ghost" leftIcon={<RotateCcw size={16} />} onClick={() => changeStatus("pending")}>
                Remettre à valider
              </Button>
            )}
            <Button variant="ghost" leftIcon={<Wand2 size={16} />} onClick={() => openRule(null)}>
              Créer une règle
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title="Créer une règle depuis ce libellé">
        <RuleSuggestionForm
          transactionId={tx.id}
          rawLabel={tx.raw_label}
          accountId={tx.account?.id ?? ""}
          defaultSubcategoryId={subcategoryId}
          subcategoryOptions={subcategoryOptions}
          merchantId={ruleMerchant?.id ?? null}
          merchantName={ruleMerchant?.name ?? null}
          onDone={() => setRuleOpen(false)}
        />
      </Modal>
    </div>
  );
}
