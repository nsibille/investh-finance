"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/format/currency";
import type { TransactionsSummary, TransactionFlow } from "@/lib/transactions/types";

type Kind = "revenus" | "depenses" | "solde" | "epargne";

const FLOW_CARDS: { flow: TransactionFlow; kind: Kind; label: string }[] = [
  { flow: "income", kind: "revenus", label: "Revenus" },
  { flow: "expense", kind: "depenses", label: "Dépensé" },
  { flow: "investment", kind: "epargne", label: "Investi" },
];

/**
 * Bandeau de KPIs en tête du listing des transactions : reflète le jeu filtré
 * complet (toutes pages), classé par type de catégorie — revenus, dépensé,
 * investi — plus le solde net budgétaire et le nombre d'opérations. Les trois
 * premières cartes sont cliquables : elles filtrent la liste sur leur flux
 * (bascule ; les autres filtres sont conservés). La vue d'ensemble, elle, reste
 * stable quel que soit le flux sélectionné.
 */
export function TransactionsSummaryBar({ summary }: { summary: TransactionsSummary }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("flow");

  const value: Record<TransactionFlow, number> = {
    income: summary.totalIncome,
    expense: summary.totalExpense,
    investment: summary.totalInvested,
  };

  function hrefFor(flow: TransactionFlow): string {
    const next = new URLSearchParams(params.toString());
    if (active === flow) next.delete("flow");
    else next.set("flow", flow);
    next.delete("page");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "var(--space-4)",
        marginBottom: "var(--space-5)",
      }}
    >
      {FLOW_CARDS.map(({ flow, kind, label }) => {
        const isActive = active === flow;
        return (
          <Link
            key={flow}
            href={hrefFor(flow)}
            scroll={false}
            className="kpi-link"
            data-active={isActive || undefined}
            aria-pressed={isActive}
            title={isActive ? `Retirer le filtre « ${label} »` : `Filtrer sur « ${label} »`}
          >
            <KpiCard kind={kind} label={label} value={formatCurrency(value[flow])} />
          </Link>
        );
      })}
      <KpiCard kind="solde" label="Solde net" value={formatCurrency(summary.net)} />
      <KpiCard
        kind="solde"
        label={summary.count > 1 ? "Transactions" : "Transaction"}
        value={String(summary.count)}
      />
    </div>
  );
}
