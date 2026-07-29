import Link from "next/link";
import { Store, Globe, ArrowRight, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format/currency";
import type { MerchantStats } from "@/lib/merchants/stats";

const MONTH_LABELS = [
  "J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D",
];
function monthInitial(ym: string): string {
  const m = Number(ym.split("-")[1]);
  return MONTH_LABELS[m - 1] ?? "";
}
function monthFull(ym: string): string {
  const [y, m] = ym.split("-");
  const names = [
    "janv.", "févr.", "mars", "avr.", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc.",
  ];
  return `${names[Number(m) - 1]} ${y}`;
}

/** Fiche détail (lecture) d'une enseigne : stats, 12 mois, catégories, lien liste. */
export function MerchantDetailView({ stats }: { stats: MerchantStats }) {
  const maxMonth = Math.max(1, ...stats.monthly.map((m) => m.amount));
  const maxCat = Math.max(1, ...stats.categories.map((c) => c.amount));
  const flowKind = stats.isIncome ? "revenus" : "depenses";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
            <span className="merchant-detail__icon"><Store size={22} aria-hidden /></span>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: "var(--text-2xl)", margin: 0 }}>{stats.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: 2, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                {stats.categoryLabel && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span className="badge-dot" style={{ ["--dot-color" as string]: stats.categoryColor ?? undefined }} />
                    {stats.categoryLabel}
                  </span>
                )}
                {stats.isOnline ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Globe size={13} aria-hidden /> En ligne
                  </span>
                ) : stats.country ? (
                  <span>{stats.country}</span>
                ) : null}
              </div>
            </div>
          </div>
          <Link href="/enseignes" className="btn-secondary-md" style={{ textDecoration: "none" }}>
            <Pencil size={14} aria-hidden />
            Gérer les enseignes
          </Link>
        </div>
      </Card>

      {stats.transactionCount === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title="Aucune transaction"
            description="Aucune transaction n'est encore rattachée à cette enseigne."
          />
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
            <KpiCard kind={flowKind} label={stats.isIncome ? "Total perçu" : "Total dépensé"} value={formatCurrency(stats.total)} />
            <KpiCard kind="solde" label="Transactions" value={String(stats.transactionCount)} />
            <KpiCard kind={flowKind} label={stats.isIncome ? "Revenu moyen / mois" : "Dépense moyenne / mois"} value={formatCurrency(stats.avgMonthly)} />
            <KpiCard kind="epargne" label="Achats rattachés" value={String(stats.purchaseCount)} />
          </div>

          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <h2 style={{ fontSize: "var(--text-base)", margin: 0 }}>{stats.isIncome ? "Revenus" : "Dépenses"} des 12 derniers mois</h2>
              <div className="mq-bars mq-bars--lg">
                {stats.monthly.map((m) => (
                  <div key={m.month} className="mq-bars__col" title={`${monthFull(m.month)} : ${formatCurrency(m.amount)}`}>
                    <div className="mq-bars__track">
                      <div className="mq-bars__fill" style={{ height: `${Math.round((m.amount / maxMonth) * 100)}%` }} />
                    </div>
                    <span className="mq-bars__label">{monthInitial(m.month)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {stats.categories.length > 0 && (
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <h2 style={{ fontSize: "var(--text-base)", margin: 0 }}>Répartition par catégorie</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {stats.categories.map((c) => (
                    <div key={c.key} className="md-cat">
                      <div className="md-cat__head">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
                          <span className="badge-dot" style={{ ["--dot-color" as string]: c.color ?? undefined }} />
                          <span className="md-cat__name">{c.label}</span>
                          <span className="mq-cat__count">{c.count}</span>
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>{formatCurrency(c.amount)}</span>
                      </div>
                      <div className="md-cat__track">
                        <div className="md-cat__fill" style={{ width: `${Math.round((c.amount / maxCat) * 100)}%`, background: c.color ?? "var(--color-brand-primary)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Link href={`/transactions?merchant=${stats.id}`} className="btn-secondary-md" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
            Voir les {stats.transactionCount} transaction{stats.transactionCount > 1 ? "s" : ""}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </>
      )}
    </div>
  );
}
