import { Suspense } from "react";
import { format } from "date-fns";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Amount } from "@/components/ui/Amount";
import { AccountAvatar } from "@/components/ui/Avatar";
import { MonthZoomSelector } from "@/components/dashboard/MonthZoomSelector";
import { SegmentAnalysis } from "@/components/dashboard/SegmentAnalysis";
import { MissingRecurringAlert } from "@/components/recurring/MissingRecurringAlert";
import { DashboardFlowChart } from "@/components/ui/charts/lazy";
import { getDashboardData } from "@/lib/dashboard/analysis";
import { SEGMENT_TYPE_SLUGS } from "@/lib/dashboard/segments";
import { getAccountsWithBalances } from "@/lib/accounts/queries";
import { getMissingRecurring } from "@/lib/recurring/queries";
import { formatCurrency } from "@/lib/format/currency";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ zoom?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const zoom = sp.zoom && /^\d{4}-\d{2}$/.test(sp.zoom) ? sp.zoom : null;

  const [data, accounts, missingRecurring] = await Promise.all([
    getDashboardData(now, zoom),
    getAccountsWithBalances(),
    getMissingRecurring(),
  ]);

  // Le zoom n'est retenu que s'il tombe dans la fenêtre de 12 mois affichée.
  const validZoom = zoom && data.months.includes(zoom) ? zoom : null;
  const refIndex = validZoom ? data.months.indexOf(validZoom) : data.months.length - 1;
  const scopeLabel = validZoom
    ? format(new Date(`${validZoom}-01T00:00:00`), "LLLL yyyy")
    : "année glissante";

  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const { from: scopeFrom, to: scopeTo } = { from: data.scopeFrom, to: data.scopeTo };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <MissingRecurringAlert missing={missingRecurring} />

      <section className="dashboard-hero">
        <div className="deco-aurora-gradient" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
          <div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--fw-semibold)", letterSpacing: "var(--tracking-tight)", margin: 0 }}>
              Tableau de bord
            </h1>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "var(--space-1) 0 0", textTransform: "capitalize" }}>
              {scopeLabel}
            </p>
          </div>
          <Suspense>
            <MonthZoomSelector months={data.months} labels={data.monthLabels} zoom={validZoom} />
          </Suspense>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "var(--space-4)" }}>
          <KpiCard kind="revenus" label="Revenus" value={formatCurrency(data.totals.revenus)} />
          <KpiCard kind="depenses" label="Dépenses" value={formatCurrency(data.totals.depenses)} />
          <KpiCard kind="epargne" label="Investissements" value={formatCurrency(data.totals.investissements)} />
          <KpiCard kind="solde" label="Solde" value={formatCurrency(data.totals.solde)} />
        </div>
      </section>

      {/* Premier étage : comptes */}
      <Card>
        <h2 className="card-analytics__title">Comptes</h2>
        {activeAccounts.length === 0 ? (
          <EmptyState title="Aucun compte" description="Crée un compte pour suivre tes soldes." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-3)" }}>
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

      {/* Vue d'ensemble : flux mensuels sur l'année glissante */}
      <Card>
        <h2 className="card-analytics__title">Revenus · Dépenses · Investissements (12 mois)</h2>
        <DashboardFlowChart data={data.series} highlightMonth={validZoom} />
      </Card>

      {/* Étages d'analyse par segment */}
      <SegmentAnalysis
        segment={data.segments.revenus}
        accent="var(--color-finance-revenus)"
        goodWhenUp
        refIndex={refIndex}
        from={scopeFrom}
        to={scopeTo}
        segmentFilter={{ flow: "income" }}
      />
      <SegmentAnalysis
        segment={data.segments.fixes}
        accent="var(--color-warning)"
        goodWhenUp={false}
        refIndex={refIndex}
        from={scopeFrom}
        to={scopeTo}
        segmentFilter={{ types: SEGMENT_TYPE_SLUGS.fixes }}
      />
      <SegmentAnalysis
        segment={data.segments.variables}
        accent="var(--color-finance-depenses)"
        goodWhenUp={false}
        refIndex={refIndex}
        from={scopeFrom}
        to={scopeTo}
        segmentFilter={{ types: SEGMENT_TYPE_SLUGS.variables }}
      />
    </div>
  );
}
