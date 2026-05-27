import { Suspense } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Amount } from "@/components/ui/Amount";
import { Dot } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthNavigator } from "@/components/dashboard/MonthNavigator";
import { ComparisonChart } from "@/components/ui/charts/ComparisonChart";
import { NetWorthChart } from "@/components/ui/charts/NetWorthChart";
import { getAnalytics } from "@/lib/analytics/queries";
import { formatShortDate } from "@/lib/format/date";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : format(new Date(), "yyyy-MM");
  const ref = new Date(`${month}-01T00:00:00`);

  const { topTransactions, topCategories, comparison, netWorth } =
    await getAnalytics(ref);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Tendances, comparaisons et évolution de ton patrimoine."
        actions={
          <Suspense>
            <MonthNavigator month={month} />
          </Suspense>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Card>
          <h2 className="card-analytics__title">Évolution du patrimoine (12 mois)</h2>
          <NetWorthChart data={netWorth} />
        </Card>

        <Card>
          <h2 className="card-analytics__title">Comparaison par catégorie</h2>
          {comparison.length === 0 ? (
            <EmptyState title="Pas assez de données" description="Valide des dépenses pour comparer les mois." />
          ) : (
            <ComparisonChart data={comparison} />
          )}
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--space-6)" }}>
          <Card>
            <h2 className="card-analytics__title">Top 10 dépenses (12 mois)</h2>
            {topTransactions.length === 0 ? (
              <EmptyState title="Aucune dépense" />
            ) : (
              <table className="table-top-transactions">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Libellé</th>
                    <th style={{ textAlign: "right" }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {topTransactions.map((t) => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatShortDate(t.date)}</td>
                      <td>
                        <Link href={`/transactions/${t.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {t.label}
                        </Link>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Amount value={t.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card>
            <h2 className="card-analytics__title">Top catégories (12 mois)</h2>
            {topCategories.length === 0 ? (
              <EmptyState title="Aucune dépense catégorisée" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {topCategories.map((c) => (
                  <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                      <Dot color={c.color ?? undefined} />
                      {c.name}
                    </span>
                    <Amount value={-c.total} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
