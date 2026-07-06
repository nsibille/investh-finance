import { Check } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { formatMonthLabel } from "@/lib/format/date";
import { installmentOccurrence } from "@/lib/purchases/installments";
import type { PurchaseInstallment } from "@/lib/purchases/types";

/**
 * Échéancier d'un achat : « paiements à venir et validés ». Une échéance
 * appariée à une transaction est considérée validée (✓), sinon à venir.
 * Purement présentationnel → utilisable côté serveur comme côté client.
 */
export function PurchaseInstallments({
  installments,
  isRecurring,
  recurrenceEnd,
}: {
  installments: PurchaseInstallment[];
  isRecurring: boolean;
  recurrenceEnd: string | null;
}) {
  if (installments.length === 0) return null;
  const startMonth = installments[0]?.month;
  const total = installments.length;
  const endless = isRecurring && !recurrenceEnd;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {installments.map((inst) => {
        const occurrence = installmentOccurrence(startMonth ?? inst.month, inst.month);
        return (
          <div
            key={inst.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              fontSize: "var(--text-sm)",
              opacity: inst.transaction_id ? 1 : 0.7,
            }}
          >
            <span style={{ flex: 1, textTransform: "capitalize" }}>
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
            <Amount value={Number(inst.amount)} size="sm" tone="neutral" />
            {inst.transaction_id ? (
              <span
                title="Payée (appariée à une transaction)"
                style={{ color: "var(--color-success)", display: "inline-flex" }}
              >
                <Check size={15} aria-hidden />
              </span>
            ) : (
              <span
                title="Prévue, non appariée"
                style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}
              >
                à venir
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
