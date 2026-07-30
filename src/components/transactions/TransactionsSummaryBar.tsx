"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/format/currency";
import type { TransactionsSummary, SummaryType } from "@/lib/transactions/types";

type Kind = "revenus" | "frais-fixes" | "depenses" | "epargne";

/**
 * Cartes agrégées par TYPE de catégorie. `slug` = valeur du param `types`
 * (filtre de la liste au clic) ; `totalKey` = clé de `summary.totals` ; `kind`
 * = variante couleur de la `KpiCard`. Les virements internes (neutres) et les
 * non catégorisées n'ont pas de carte. Les prélèvements sont fondus dans les
 * frais fixes (une seule carte, qui filtre les deux types).
 */
const TYPE_CARDS: {
  slug: string;
  totalKey: SummaryType;
  kind: Kind;
  label: string;
}[] = [
  { slug: "revenus", totalKey: "revenus", kind: "revenus", label: "Revenus" },
  { slug: "frais-fixes,prelevements", totalKey: "fraisFixes", kind: "frais-fixes", label: "Frais fixes" },
  { slug: "frais-variables", totalKey: "fraisVariables", kind: "depenses", label: "Frais variables" },
  { slug: "investissements", totalKey: "investissements", kind: "epargne", label: "Investi" },
];

/**
 * Bandeau de KPIs en tête du listing des transactions : un total par type de
 * catégorie (revenus, prélèvements, frais fixes, frais variables, investi),
 * plus le solde net budgétaire et le nombre d'opérations. Chaque carte de type
 * est cliquable : elle filtre la liste sur ce type (bascule ; les autres filtres
 * sont conservés). La vue d'ensemble, elle, reste stable quel que soit le type
 * sélectionné.
 */
export function TransactionsSummaryBar({ summary }: { summary: TransactionsSummary }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("types");

  function hrefFor(slug: string): string {
    const next = new URLSearchParams(params.toString());
    if (active === slug) next.delete("types");
    else next.set("types", slug);
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
      {TYPE_CARDS.map(({ slug, totalKey, kind, label }) => {
        const isActive = active === slug;
        return (
          <Link
            key={slug}
            href={hrefFor(slug)}
            scroll={false}
            className="kpi-link"
            data-active={isActive || undefined}
            aria-pressed={isActive}
            title={isActive ? `Retirer le filtre « ${label} »` : `Filtrer sur « ${label} »`}
          >
            <KpiCard kind={kind} label={label} value={formatCurrency(summary.totals[totalKey])} />
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
