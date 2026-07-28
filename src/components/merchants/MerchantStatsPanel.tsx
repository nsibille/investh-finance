"use client";

import { useMemo } from "react";
import {
  Store,
  Globe,
  MapPin,
  Receipt,
  Wallet,
  CalendarClock,
  TrendingUp,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { MerchantSpendChart } from "@/components/ui/charts/lazy";
import { formatCurrency } from "@/lib/format/currency";
import type { MerchantStats } from "@/lib/merchants/stats";

const MONTH_LABELS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
function monthShort(ym: string): string {
  return MONTH_LABELS[Number(ym.split("-")[1]) - 1] ?? ym;
}
function monthYearLong(ym: string): string {
  const [y, m] = ym.split("-");
  const names = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${names[Number(m) - 1] ?? m} ${y}`;
}
function dayMonthYear(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function KpiTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="ms-kpi">
      <span className="ms-kpi__icon">{icon}</span>
      <span className="ms-kpi__label">{label}</span>
      <span className="ms-kpi__value">{value}</span>
      {hint && <span className="ms-kpi__hint">{hint}</span>}
    </div>
  );
}

/**
 * Panneau statistiques d'une enseigne, affiché à droite dans la modale de détail
 * (KPIs, fun fact, graphe des dépenses sur 12 mois, top catégories).
 */
export function MerchantStatsPanel({ stats }: { stats: MerchantStats }) {
  const {
    name,
    categoryLabel,
    categoryColor,
    isOnline,
    country,
    totalSpent,
    netAmount,
    transactionCount,
    purchaseCount,
    firstDate,
    lastDate,
    maxSpend,
    avgMonthly,
    monthly,
    categories,
  } = stats;

  const chartData = useMemo(
    () =>
      monthly.map((p) => ({
        label: monthShort(p.month),
        year: Number(p.month.split("-")[0]),
        depenses: p.depenses,
      })),
    [monthly],
  );

  const basket = transactionCount > 0 ? totalSpent / transactionCount : 0;
  const refunded = Math.max(0, netAmount + totalSpent); // crédits = net + débits
  const activeMonths = monthly.filter((m) => m.depenses > 0).length;

  // Mois record (fenêtre 12 mois).
  const record = monthly.reduce<{ month: string; depenses: number } | null>(
    (best, m) => (m.depenses > (best?.depenses ?? 0) ? m : best),
    null,
  );

  // Fun facts candidats : on garde les plus parlants.
  const funFacts: { emoji: string; text: string }[] = [];
  if (maxSpend) {
    funFacts.push({
      emoji: "💥",
      text: `Plus grosse dépense : ${formatCurrency(maxSpend.amount)} le ${dayMonthYear(maxSpend.date)}.`,
    });
  }
  if (record && record.depenses > 0) {
    funFacts.push({
      emoji: "🗓️",
      text: `Mois record : ${monthYearLong(record.month)} avec ${formatCurrency(record.depenses)}.`,
    });
  }
  if (firstDate) {
    funFacts.push({
      emoji: "🤝",
      text: `Première dépense le ${dayMonthYear(firstDate)} — déjà ${transactionCount} opération${transactionCount > 1 ? "s" : ""}.`,
    });
  }
  if (refunded > 0.01) {
    funFacts.push({
      emoji: "↩️",
      text: `${formatCurrency(refunded)} te sont revenus (remboursements / avoirs).`,
    });
  }

  if (transactionCount === 0) {
    return (
      <div className="ms-panel">
        <div className="ms-head">
          <span className="ms-head__icon"><Store size={18} aria-hidden /></span>
          <div className="ms-head__title">
            <span className="ms-head__name">{name}</span>
            <MerchantMeta categoryLabel={categoryLabel} categoryColor={categoryColor} isOnline={isOnline} country={country} />
          </div>
        </div>
        <div className="ms-empty">
          <Sparkles size={22} aria-hidden />
          <p>Aucune transaction rattachée pour l&apos;instant.</p>
          <span>Les statistiques apparaîtront dès la première dépense associée à cette enseigne.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-panel">
      <div className="ms-head">
        <span className="ms-head__icon"><Store size={18} aria-hidden /></span>
        <div className="ms-head__title">
          <span className="ms-head__name">{name}</span>
          <MerchantMeta categoryLabel={categoryLabel} categoryColor={categoryColor} isOnline={isOnline} country={country} />
        </div>
      </div>

      {/* Héro : total dépensé */}
      <div className="ms-hero">
        <span className="ms-hero__label">Total dépensé</span>
        <span className="ms-hero__value">{formatCurrency(totalSpent)}</span>
        <span className="ms-hero__sub">
          {transactionCount} transaction{transactionCount > 1 ? "s" : ""}
          {activeMonths > 0 ? ` · sur ${activeMonths} mois actif${activeMonths > 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {/* KPIs */}
      <div className="ms-kpis">
        <KpiTile icon={<Receipt size={15} />} label="Panier moyen" value={formatCurrency(basket)} />
        <KpiTile icon={<TrendingUp size={15} />} label="Moy. / mois" value={formatCurrency(avgMonthly)} />
        <KpiTile
          icon={<Wallet size={15} />}
          label="Solde net"
          value={formatCurrency(netAmount)}
          hint={refunded > 0.01 ? `${formatCurrency(refunded)} remboursés` : undefined}
        />
        <KpiTile
          icon={<ShoppingBag size={15} />}
          label="Achats liés"
          value={String(purchaseCount)}
          hint={lastDate ? `Dernière : ${dayMonthYear(lastDate)}` : undefined}
        />
      </div>

      {/* Fun fact(s) */}
      {funFacts.length > 0 && (
        <div className="ms-funfacts">
          {funFacts.slice(0, 2).map((f, i) => (
            <div key={i} className="ms-funfact">
              <span className="ms-funfact__emoji" aria-hidden>{f.emoji}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Graphe 12 mois */}
      <div className="ms-section">
        <div className="ms-section__head">
          <span className="ms-section__title"><CalendarClock size={14} aria-hidden /> Dépenses sur 12 mois</span>
          {avgMonthly > 0 && (
            <span className="ms-section__legend">
              <span className="ms-avgline" aria-hidden /> moy. {formatCurrency(avgMonthly)}
            </span>
          )}
        </div>
        <MerchantSpendChart data={chartData} average={avgMonthly} />
      </div>

      {/* Top catégories */}
      {categories.length > 0 && (
        <div className="ms-section">
          <span className="ms-section__title">Répartition par catégorie</span>
          <div className="ms-cats">
            {categories.slice(0, 5).map((c) => {
              const pct = totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0;
              return (
                <div key={c.key} className="ms-cat">
                  <span className="badge-dot" style={{ ["--dot-color" as string]: c.color ?? undefined }} aria-hidden />
                  <span className="ms-cat__name">{c.label}</span>
                  <span className="ms-cat__bar" aria-hidden>
                    <span className="ms-cat__bar-fill" style={{ width: `${pct}%`, background: c.color ?? "var(--color-brand-primary)" }} />
                  </span>
                  <span className="ms-cat__amount">{formatCurrency(c.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MerchantMeta({
  categoryLabel,
  categoryColor,
  isOnline,
  country,
}: {
  categoryLabel: string | null;
  categoryColor: string | null;
  isOnline: boolean;
  country: string | null;
}) {
  if (!categoryLabel && !isOnline && !country) return null;
  return (
    <span className="ms-head__meta">
      {categoryLabel && (
        <span className="ms-head__cat">
          <span className="badge-dot" style={{ ["--dot-color" as string]: categoryColor ?? undefined }} aria-hidden />
          {categoryLabel}
        </span>
      )}
      {isOnline ? (
        <span className="ms-head__loc"><Globe size={11} aria-hidden /> En ligne</span>
      ) : country ? (
        <span className="ms-head__loc"><MapPin size={11} aria-hidden /> {country}</span>
      ) : null}
    </span>
  );
}
