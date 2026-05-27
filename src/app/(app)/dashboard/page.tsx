import { Suspense } from "react";
import { format } from "date-fns";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Amount } from "@/components/ui/Amount";
import { AccountAvatar } from "@/components/ui/Avatar";
import { MonthNavigator } from "@/components/dashboard/MonthNavigator";
import { MissingRecurringAlert } from "@/components/recurring/MissingRecurringAlert";
import { PieCategories } from "@/components/ui/charts/PieCategories";
import { BarMonthly } from "@/components/ui/charts/BarMonthly";
import {
  getMonthlyKpis,
  getCategoryBreakdown,
  getMonthlyTrend,
} from "@/lib/dashboard/queries";
import { getAccountsWithBalances } from "@/lib/accounts/queries";
import { getMissingRecurring } from "@/lib/recurring/queries";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

function deltaPercent(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month)
    ? sp.month
    : format(new Date(), "yyyy-MM");
  const ref = new Date(`${month}-01T00:00:00`);

  const [kpis, breakdown, trend, accounts, missingRecurring] =
    await Promise.all([
      getMonthlyKpis(ref),
      getCategoryBreakdown(ref),
      getMonthlyTrend(ref),
      getAccountsWithBalances(),
      getMissingRecurring(),
    ]);

  const { current, previous } = kpis;
  const activeAccounts = accounts.filter((a) => !a.is_archived);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <MissingRecurringAlert missing={missingRecurring} />
      <section className="dashboard-hero">
        <div className="deco-aurora-gradient" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--fw-semibold)", letterSpacing: "var(--tracking-tight)", margin: 0 }}>
            Tableau de bord
          </h1>
          <Suspense>
            <MonthNavigator month={month} />
          </Suspense>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
          <KpiCard kind="revenus" label="Revenus" value={formatCurrency(current.revenus)} deltaPercent={deltaPercent(current.revenus, previous.revenus)} />
          <KpiCard kind="depenses" label="Dépenses" value={formatCurrency(current.depenses)} deltaPercent={deltaPercent(current.depenses, previous.depenses)} />
          <KpiCard kind="solde" label="Solde" value={formatCurrency(current.solde)} deltaPercent={deltaPercent(current.solde, previous.solde)} />
          <KpiCard kind="epargne" label="Taux d'épargne" value={`${current.epargne.toFixed(0)} %`} deltaPercent={current.epargne - previous.epargne} />
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--space-6)" }}>
        <Card>
          <h2 className="card-analytics__title">Dépenses par catégorie</h2>
          {breakdown.length === 0 ? (
            <EmptyState title="Aucune dépense" description="Aucune dépense validée sur ce mois." />
          ) : (
            <PieCategories
              data={breakdown.map((c) => ({ name: c.name, value: c.value, color: c.color ?? undefined }))}
            />
          )}
        </Card>

        <Card>
          <h2 className="card-analytics__title">Revenus & dépenses (12 mois)</h2>
          <BarMonthly data={trend} />
        </Card>
      </div>

      <Card>
        <h2 className="card-analytics__title">Comptes</h2>
        {activeAccounts.length === 0 ? (
          <EmptyState title="Aucun compte" description="Crée un compte pour suivre tes soldes." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-3)" }}>
            {activeAccounts.map((a) => (
              <div className="card-account-mini" key={a.id}>
                <AccountAvatar type={a.type} color={a.color} />
                <div className="card-account__body">
                  <span className="card-account__name">{a.name}</span>
                  <Amount value={a.current_balance} size="md" tone="neutral" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
