import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/format/currency";
import type { TransactionsSummary } from "@/lib/transactions/types";

/**
 * Bandeau de KPIs en tête du listing des transactions : reflète le jeu filtré
 * complet (toutes pages), pas seulement la page affichée. Montants hors
 * opérations ignorées ; le compteur reflète l'ensemble affiché.
 */
export function TransactionsSummaryBar({ summary }: { summary: TransactionsSummary }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: "var(--space-4)",
        marginBottom: "var(--space-5)",
      }}
    >
      <KpiCard kind="revenus" label="Revenus" value={formatCurrency(summary.totalIncome)} />
      <KpiCard kind="depenses" label="Dépenses" value={formatCurrency(summary.totalExpense)} />
      <KpiCard kind="solde" label="Solde net" value={formatCurrency(summary.net)} />
      <KpiCard
        kind="epargne"
        label={summary.count > 1 ? "Transactions" : "Transaction"}
        value={String(summary.count)}
      />
    </div>
  );
}
