"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Unlink, Replace, Link2, Plus } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { StatusBadge, Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { formatMonthLabel, formatShortDate } from "@/lib/format/date";
import { installmentOccurrence } from "@/lib/purchases/installments";
import { Section, SectionTitle } from "./PurchaseGalaxy";
import { TransactionPickerModal } from "./TransactionPickerModal";
import {
  attachTransactionToPurchase,
  attachTransactionToInstallment,
  detachTransaction,
  unassignInstallment,
  type ActionResult,
} from "@/server/actions/purchases";
import type { PurchaseWithDetails } from "@/lib/purchases/types";

type Picker =
  | { kind: "purchase" }
  | { kind: "installment"; installmentId: string; reassign: boolean }
  | null;

/**
 * `purchase-assignments` — bloc interactif de la page de détail d'un achat :
 * assigner / réassigner / désassigner les transactions, aussi bien sur les
 * échéances (« paiements programmés ») que sur les transactions simplement
 * rattachées. Remplace, via `assignmentsSlot`, les sections en lecture seule de
 * `purchase-galaxy`.
 */
export function PurchaseAssignments({ purchase: p }: { purchase: PurchaseWithDetails }) {
  const router = useRouter();
  const toast = useToast();
  const [picker, setPicker] = useState<Picker>(null);

  const txById = new Map(p.transactions.map((t) => [t.id, t]));
  const matchedTxIds = new Set(
    p.installments.map((i) => i.transaction_id).filter((x): x is string => !!x),
  );
  // Transactions rattachées « libres » : hors de celles qui règlent une échéance
  // (ces dernières apparaissent déjà dans la section des paiements).
  const looseTxs = p.transactions.filter((t) => !matchedTxIds.has(t.id));

  const startMonth = p.installments[0]?.month;
  const total = p.installments.length;
  const endless = p.is_recurring && !p.recurrence_end;

  async function run(action: Promise<ActionResult>, success: string) {
    const res = await action;
    if (!res.ok) return toast.error(res.error);
    toast.success(success);
    router.refresh();
  }

  function onPick(transactionId: string) {
    if (!picker) return;
    if (picker.kind === "purchase") {
      void run(attachTransactionToPurchase(transactionId, p.id), "Transaction rattachée");
    } else {
      void run(
        attachTransactionToInstallment(transactionId, picker.installmentId),
        picker.reassign ? "Paiement réassigné" : "Transaction assignée",
      );
    }
  }

  const pickerTitle =
    picker?.kind === "installment"
      ? picker.reassign
        ? "Réassigner le paiement"
        : "Assigner une transaction à ce paiement"
      : "Rattacher une transaction";

  return (
    <>
      {p.installments.length > 0 && (
        <Section>
          <SectionTitle>Paiements à venir et validés</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p.installments.map((inst) => {
              const occurrence = installmentOccurrence(startMonth ?? inst.month, inst.month);
              const tx = inst.transaction_id ? txById.get(inst.transaction_id) : null;
              const matched = Boolean(inst.transaction_id);
              return (
                <div
                  key={inst.id}
                  className="purchase-line-row"
                  style={{ opacity: matched ? 1 : 0.7 }}
                >
                  <span className="purchase-line-row__main">
                    <span className="purchase-line-row__label" style={{ textTransform: "capitalize" }}>
                      {formatMonthLabel(inst.month)}
                      {(total > 1 || endless) && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-muted)",
                            textTransform: "none",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {occurrence}/{endless ? "∞" : total}
                        </span>
                      )}
                    </span>
                    <span className="purchase-line-row__sub">
                      {tx ? (
                        <>
                          {tx.label}
                          {" · "}
                          {formatShortDate(tx.operation_date)}
                          {tx.accountName ? ` · ${tx.accountName}` : ""}
                        </>
                      ) : (
                        "à venir"
                      )}
                    </span>
                  </span>
                  <Amount value={Number(inst.amount)} size="sm" tone="neutral" />
                  {matched ? (
                    <>
                      <span title="Payée" style={{ color: "var(--color-success)", display: "inline-flex" }}>
                        <Check size={15} aria-hidden />
                      </span>
                      <IconButton
                        label="Réassigner à une autre transaction"
                        onClick={() =>
                          setPicker({ kind: "installment", installmentId: inst.id, reassign: true })
                        }
                      >
                        <Replace size={14} />
                      </IconButton>
                      <IconButton
                        label="Désassigner"
                        onClick={() => run(unassignInstallment(inst.id), "Paiement désassigné")}
                      >
                        <Unlink size={14} />
                      </IconButton>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Link2 size={14} />}
                      onClick={() =>
                        setPicker({ kind: "installment", installmentId: inst.id, reassign: false })
                      }
                    >
                      Assigner
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section>
        <SectionTitle count={looseTxs.length}>
          {p.installments.length > 0 ? "Autres transactions rattachées" : "Transactions rattachées"}
        </SectionTitle>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {looseTxs.map((t) => (
            <div key={t.id} className="purchase-line-row">
              {t.accountColor ? <Dot color={t.accountColor} /> : null}
              <Link
                href={`/transactions/${t.id}`}
                className="purchase-line-row__main"
                style={{ textDecoration: "none" }}
              >
                <span className="purchase-line-row__label">{t.label}</span>
                <span className="purchase-line-row__sub">
                  {formatShortDate(t.operation_date)}
                  {t.accountName ? ` · ${t.accountName}` : ""}
                </span>
              </Link>
              <Amount value={t.amount} currency={t.currency} size="sm" />
              <StatusBadge status={t.status} />
              <IconButton
                label="Désassigner"
                onClick={() => run(detachTransaction(t.id), "Transaction désassignée")}
              >
                <Unlink size={14} />
              </IconButton>
            </div>
          ))}
          {looseTxs.length === 0 && (
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
                padding: "var(--space-1) var(--space-2)",
              }}
            >
              Aucune transaction rattachée directement.
            </span>
          )}
        </div>
        <div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => setPicker({ kind: "purchase" })}
          >
            Rattacher une transaction
          </Button>
        </div>
      </Section>

      <TransactionPickerModal
        key={
          picker === null
            ? "closed"
            : picker.kind === "purchase"
              ? "purchase"
              : `installment-${picker.installmentId}-${picker.reassign ? "re" : "new"}`
        }
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={pickerTitle}
        onPick={onPick}
      />
    </>
  );
}
