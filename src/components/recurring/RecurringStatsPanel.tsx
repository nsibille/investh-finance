"use client";

import {
  Repeat,
  Store,
  Wallet,
  CalendarClock,
  TrendingUp,
  CalendarDays,
  Sparkles,
  Gauge,
} from "lucide-react";
import { MerchantSpendChart } from "@/components/ui/charts/lazy";
import { formatCurrency } from "@/lib/format/currency";
import type { RecurringStats } from "@/lib/recurring/stats";

const MONTH_LABELS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
function monthShort(iso: string): string {
  return MONTH_LABELS[Number(iso.split("-")[1]) - 1] ?? iso;
}
function dayMonthYear(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Libellé lisible d'une fréquence en jours (rapproché du préréglage le plus proche). */
function frequencyLabel(days: number): string {
  const presets: [number, string][] = [
    [7, "Hebdo."],
    [14, "Bimensuel"],
    [30, "Mensuel"],
    [60, "Bimestriel"],
    [90, "Trimestriel"],
    [182, "Semestriel"],
    [365, "Annuel"],
  ];
  const match = presets.find(([d]) => Math.abs(d - days) <= 2);
  return match ? match[1] : `${days} j`;
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
 * Panneau statistiques d'une récurrence, affiché à gauche dans la modale
 * d'édition : cumul payé, versement moyen, coût annualisé, prochaine échéance,
 * fun facts et graphe temporel des derniers versements.
 */
export function RecurringStatsPanel({ stats }: { stats: RecurringStats }) {
  const {
    name,
    categoryLabel,
    categoryColor,
    merchantName,
    accountName,
    frequencyDays,
    occurrenceCount,
    totalAmount,
    avgAmount,
    minAmount,
    maxAmount,
    firstDate,
    lastDate,
    nextExpected,
    annualized,
    occurrences,
  } = stats;

  const chartData = occurrences.map((o) => ({
    label: monthShort(o.date),
    year: Number(o.date.split("-")[0]),
    depenses: o.amount,
  }));

  // Fun facts : dérive de prix, record, ancienneté, coût annualisé.
  const funFacts: { emoji: string; text: string }[] = [];
  if (
    occurrences.length >= 2 &&
    minAmount != null &&
    maxAmount != null &&
    maxAmount - minAmount > 0.01
  ) {
    const first = occurrences[0].amount;
    const last = occurrences[occurrences.length - 1].amount;
    if (Math.abs(last - first) > 0.01) {
      funFacts.push({
        emoji: last > first ? "📈" : "📉",
        text: `Le montant est passé de ${formatCurrency(first)} à ${formatCurrency(last)}.`,
      });
    }
  }
  if (annualized > 0) {
    funFacts.push({
      emoji: "🗓️",
      text: `À ce rythme, ≈ ${formatCurrency(annualized)} par an.`,
    });
  }
  if (firstDate) {
    funFacts.push({
      emoji: "🤝",
      text: `Premier versement le ${dayMonthYear(firstDate)} — déjà ${occurrenceCount} fois.`,
    });
  }
  if (maxAmount != null && maxAmount - avgAmount > 0.01) {
    funFacts.push({
      emoji: "💥",
      text: `Plus gros versement : ${formatCurrency(maxAmount)}.`,
    });
  }

  if (occurrenceCount === 0) {
    return (
      <div className="ms-panel">
        <Head
          name={name}
          categoryLabel={categoryLabel}
          categoryColor={categoryColor}
          merchantName={merchantName}
          accountName={accountName}
          frequencyDays={frequencyDays}
        />
        <div className="ms-empty">
          <Sparkles size={22} aria-hidden />
          <p>Aucun versement rattaché pour l&apos;instant.</p>
          <span>
            Les statistiques apparaîtront dès qu&apos;une transaction sera
            associée à cette récurrence.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-panel">
      <Head
        name={name}
        categoryLabel={categoryLabel}
        categoryColor={categoryColor}
        merchantName={merchantName}
        accountName={accountName}
        frequencyDays={frequencyDays}
      />

      {/* Héro : cumul payé */}
      <div className="ms-hero">
        <span className="ms-hero__label">Cumul payé</span>
        <span className="ms-hero__value">{formatCurrency(totalAmount)}</span>
        <span className="ms-hero__sub">
          {occurrenceCount} versement{occurrenceCount > 1 ? "s" : ""}
          {firstDate ? ` · depuis le ${dayMonthYear(firstDate)}` : ""}
        </span>
      </div>

      {/* KPIs */}
      <div className="ms-kpis">
        <KpiTile icon={<Wallet size={15} />} label="Versement moyen" value={formatCurrency(avgAmount)} />
        <KpiTile icon={<TrendingUp size={15} />} label="Coût / an" value={formatCurrency(annualized)} />
        <KpiTile
          icon={<CalendarDays size={15} />}
          label="Prochaine"
          value={nextExpected ? dayMonthYear(nextExpected) : "—"}
        />
        <KpiTile
          icon={<Gauge size={15} />}
          label="Fréquence"
          value={frequencyLabel(frequencyDays)}
          hint={lastDate ? `Dernier : ${dayMonthYear(lastDate)}` : undefined}
        />
      </div>

      {/* Fun facts */}
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

      {/* Graphe temporel des versements */}
      {chartData.length > 0 && (
        <div className="ms-section">
          <div className="ms-section__head">
            <span className="ms-section__title">
              <CalendarClock size={14} aria-hidden /> Derniers versements
            </span>
            {avgAmount > 0 && (
              <span className="ms-section__legend">
                <span className="ms-avgline" aria-hidden /> moy. {formatCurrency(avgAmount)}
              </span>
            )}
          </div>
          <MerchantSpendChart data={chartData} average={avgAmount} />
        </div>
      )}
    </div>
  );
}

function Head({
  name,
  categoryLabel,
  categoryColor,
  merchantName,
  accountName,
  frequencyDays,
}: {
  name: string;
  categoryLabel: string | null;
  categoryColor: string | null;
  merchantName: string | null;
  accountName: string | null;
  frequencyDays: number;
}) {
  return (
    <div className="ms-head">
      <span className="ms-head__icon"><Repeat size={18} aria-hidden /></span>
      <div className="ms-head__title">
        <span className="ms-head__name">{name}</span>
        <span className="ms-head__meta">
          {categoryLabel && (
            <span className="ms-head__cat">
              <span className="badge-dot" style={{ ["--dot-color" as string]: categoryColor ?? undefined }} aria-hidden />
              {categoryLabel}
            </span>
          )}
          {merchantName && (
            <span className="ms-head__loc"><Store size={11} aria-hidden /> {merchantName}</span>
          )}
          <span className="ms-head__loc">
            <Repeat size={11} aria-hidden /> {frequencyLabel(frequencyDays)}
          </span>
          {accountName && <span className="ms-head__loc">{accountName}</span>}
        </span>
      </div>
    </div>
  );
}
