"use client";

import { useMemo } from "react";
import {
  ShoppingBag,
  Store,
  Wallet,
  Hourglass,
  Receipt,
  CalendarClock,
  ListChecks,
  Sparkles,
  CheckCircle2,
  HandCoins,
} from "lucide-react";
import { PurchaseTimelineChart } from "@/components/ui/charts/lazy";
import { formatCurrency } from "@/lib/format/currency";
import type { PurchaseWithDetails } from "@/lib/purchases/types";

const MONTH_LABELS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
const MONTH_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const monthIdx = (ym: string) => Number(ym.slice(5, 7)) - 1;
const monthShort = (ym: string) => MONTH_LABELS[monthIdx(ym)] ?? ym;
const monthYearLong = (ym: string) => `${MONTH_LONG[monthIdx(ym)] ?? ym} ${ym.slice(0, 4)}`;
const dayMonthYear = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

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
 * Panneau statistiques d'un achat, affiché à droite dans la modale de détail
 * (KPIs, avancement, fun facts, graphe des paiements dans le temps, échéances à
 * venir, transactions rattachées). Même format que le panneau enseigne.
 */
export function PurchaseStatsPanel({ purchase: p }: { purchase: PurchaseWithDetails }) {
  // Un achat peut se faire à plusieurs : on distingue le dépensé (débits) des
  // versements reçus (crédits) pour un coût net juste.
  const paid = p.spentAmount;
  const received = p.receivedAmount;
  const net = p.netAmount;
  const shared = received > 0.01;
  const forecast = Math.abs(p.forecastAmount);
  const remaining = Math.abs(p.remaining);
  const hasInstallments = p.installments.length > 0;
  const endless = p.is_recurring && !p.recurrence_end;

  // Total prévu : somme de l'échéancier si présent, sinon le réalisé.
  const plannedTotal = hasInstallments ? forecast : paid;
  const progressPct = hasInstallments
    ? Math.min(100, Math.round((p.matchedInstallments / p.installments.length) * 100))
    : p.isFullyPaid || p.transactionCount > 0
      ? 100
      : 0;

  // Série temporelle : par échéance (payée / à venir) sinon par mois de transaction.
  const timeline = useMemo(() => {
    if (hasInstallments) {
      return p.installments
        .map((i) => ({ ym: i.month.slice(0, 7), amount: Math.abs(Number(i.amount)), upcoming: !i.transaction_id }))
        .sort((a, b) => a.ym.localeCompare(b.ym));
    }
    const byMonth = new Map<string, number>();
    for (const t of p.transactions) {
      // Paiements = débits uniquement ; les versements reçus ne sont pas des paiements.
      if (t.amount >= 0) continue;
      const ym = t.operation_date.slice(0, 7);
      byMonth.set(ym, (byMonth.get(ym) ?? 0) + -t.amount);
    }
    return [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, amount]) => ({ ym, amount, upcoming: false }));
  }, [p.installments, p.transactions, hasInstallments]);

  const chartData = useMemo(
    () =>
      timeline.map((pt) => ({
        label: monthShort(pt.ym),
        year: Number(pt.ym.slice(0, 4)),
        amount: pt.amount,
        upcoming: pt.upcoming,
      })),
    [timeline],
  );

  const upcoming = p.installments.filter((i) => !i.transaction_id);
  const nextDue = upcoming[0] ?? null;
  // Plus grosse dépense : sur les débits seulement (pas les versements reçus).
  const biggestTx = p.transactions.reduce<{ amount: number; date: string } | null>(
    (best, t) => {
      if (t.amount >= 0) return best;
      const a = -t.amount;
      return !best || a > best.amount ? { amount: a, date: t.operation_date } : best;
    },
    null,
  );

  // Fun facts.
  const funFacts: { emoji: string; text: string }[] = [];
  if (p.isFullyPaid) {
    funFacts.push({ emoji: "🎉", text: `Achat soldé — ${formatCurrency(paid)} au total.` });
  } else if (hasInstallments) {
    funFacts.push({
      emoji: "📊",
      text: `${p.matchedInstallments}/${p.installments.length} échéance${p.installments.length > 1 ? "s" : ""} réglée${p.matchedInstallments > 1 ? "s" : ""} (${progressPct} %).`,
    });
  }
  if (nextDue) {
    funFacts.push({
      emoji: "📅",
      text: `Prochaine échéance : ${monthYearLong(nextDue.month.slice(0, 7))} — ${formatCurrency(Math.abs(Number(nextDue.amount)))}.`,
    });
  }
  if (biggestTx) {
    funFacts.push({
      emoji: "💥",
      text: `Plus grosse dépense : ${formatCurrency(biggestTx.amount)} le ${dayMonthYear(biggestTx.date)}.`,
    });
  }
  if (endless) {
    funFacts.push({ emoji: "🔁", text: "Abonnement sans fin — échéances générées en continu." });
  } else if (p.firstTransactionDate) {
    funFacts.push({ emoji: "🤝", text: `Démarré le ${dayMonthYear(p.firstTransactionDate)}.` });
  }

  const statusChip = p.isFullyPaid
    ? { cls: "badge-status-validated", label: "Soldé" }
    : endless
      ? { cls: "badge-status-new", label: "Abonnement" }
      : remaining > 0.01
        ? { cls: "badge-status-pending", label: "En cours" }
        : { cls: "badge-status-new", label: "Direct" };

  return (
    <div className="ms-panel">
      <div className="ms-head">
        <span className="ms-head__icon"><ShoppingBag size={18} aria-hidden /></span>
        <div className="ms-head__title">
          <span className="ms-head__name">{p.name}</span>
          <span className="ms-head__meta">
            {p.categoryLabel && (
              <span className="ms-head__cat">
                <span className="badge-dot" style={{ ["--dot-color" as string]: p.categoryColor ?? undefined }} aria-hidden />
                {p.categoryLabel}
              </span>
            )}
            {p.merchantName && (
              <span className="ms-head__loc"><Store size={11} aria-hidden /> {p.merchantName}</span>
            )}
            <span className={statusChip.cls}>{statusChip.label}</span>
          </span>
        </div>
      </div>

      {/* Héro : coût net (partagé) ou payé */}
      <div className="ms-hero">
        <span className="ms-hero__label">{shared ? "Coût net" : "Payé"}</span>
        <span className="ms-hero__value">{formatCurrency(shared ? net : paid)}</span>
        <span className="ms-hero__sub">
          {shared ? `${formatCurrency(paid)} dépensés · ${formatCurrency(received)} reçus` : `${p.transactionCount} transaction${p.transactionCount > 1 ? "s" : ""}`}
          {plannedTotal > 0.01 && !endless ? ` · sur ${formatCurrency(plannedTotal)} prévu` : ""}
          {remaining > 0.01 ? ` · reste ${formatCurrency(remaining)}` : ""}
        </span>
        {plannedTotal > 0.01 && !endless && (
          <div className="ms-progress" title={`${progressPct} %`}>
            <span className="ms-progress__fill" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="ms-kpis">
        <KpiTile
          icon={<Wallet size={15} />}
          label="Dépensé"
          value={formatCurrency(paid)}
          hint={shared ? `net ${formatCurrency(net)}` : undefined}
        />
        {shared ? (
          <KpiTile icon={<HandCoins size={15} />} label="Versements reçus" value={formatCurrency(received)} />
        ) : (
          <KpiTile icon={<Hourglass size={15} />} label="Reste à payer" value={formatCurrency(remaining)} />
        )}
        <KpiTile
          icon={<Receipt size={15} />}
          label={hasInstallments ? "Total prévu" : "Transactions"}
          value={hasInstallments ? formatCurrency(forecast) : String(p.transactionCount)}
        />
        <KpiTile
          icon={<ListChecks size={15} />}
          label="Échéances"
          value={hasInstallments ? `${p.matchedInstallments}/${p.installments.length}` : "—"}
          hint={endless ? "sans fin" : undefined}
        />
      </div>

      {/* Fun facts */}
      {funFacts.length > 0 && (
        <div className="ms-funfacts">
          {funFacts.slice(0, 3).map((f, i) => (
            <div key={i} className="ms-funfact">
              <span className="ms-funfact__emoji" aria-hidden>{f.emoji}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Graphe dans le temps */}
      {chartData.length > 0 && (
        <div className="ms-section">
          <div className="ms-section__head">
            <span className="ms-section__title"><CalendarClock size={14} aria-hidden /> Paiements dans le temps</span>
            {upcoming.length > 0 && (
              <span className="ms-section__legend">
                <span className="ms-swatch" data-upcoming aria-hidden /> à venir
                <span className="ms-swatch" aria-hidden style={{ marginLeft: 8 }} /> payé
              </span>
            )}
          </div>
          <PurchaseTimelineChart data={chartData} />
        </div>
      )}

      {/* Échéances à venir */}
      {upcoming.length > 0 && (
        <div className="ms-section">
          <span className="ms-section__title">Échéances à venir ({upcoming.length})</span>
          <div className="ms-list">
            {upcoming.slice(0, 6).map((i) => (
              <div key={i.id} className="ms-list__row" data-upcoming>
                <Hourglass size={12} aria-hidden style={{ flexShrink: 0, color: "var(--color-text-muted)" }} />
                <span className="ms-list__main" style={{ textTransform: "capitalize" }}>
                  {monthYearLong(i.month.slice(0, 7))}
                </span>
                <span className="ms-list__amount">{formatCurrency(Math.abs(Number(i.amount)))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions rattachées */}
      {p.transactions.length > 0 && (
        <div className="ms-section">
          <span className="ms-section__title">Transactions rattachées ({p.transactionCount})</span>
          <div className="ms-list">
            {p.transactions.slice(0, 6).map((t) => (
              <div key={t.id} className="ms-list__row">
                <span className="ms-list__date">{dayMonthYear(t.operation_date)}</span>
                <span className="ms-list__main">{t.label}</span>
                {t.status === "validated" ? (
                  <CheckCircle2 size={13} aria-hidden style={{ flexShrink: 0, color: "var(--color-success)" }} />
                ) : null}
                <span className="ms-list__amount">{formatCurrency(Math.abs(t.amount))}</span>
              </div>
            ))}
          </div>
          {p.transactions.length > 6 && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              + {p.transactions.length - 6} autre{p.transactions.length - 6 > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Personnes (dette / cadeau) */}
      {p.persons.length > 0 && (
        <div className="ms-section">
          <span className="ms-section__title">Personnes</span>
          <div className="ms-list">
            {p.persons.map((pers) => (
              <div key={`${pers.personId}:${pers.nature}`} className="ms-list__row">
                <span className="badge-dot" style={{ ["--dot-color" as string]: pers.color }} aria-hidden />
                <span className="ms-list__main">
                  {pers.name}
                  <span style={{ color: "var(--color-text-muted)" }}> · {pers.nature === "gift" ? "cadeau" : "dette"}</span>
                </span>
                <span className="ms-list__amount">{formatCurrency(Math.abs(pers.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.transactionCount === 0 && p.installments.length === 0 && (
        <div className="ms-empty">
          <Sparkles size={22} aria-hidden />
          <p>Aucune transaction ni échéance pour l&apos;instant.</p>
          <span>Rattache des transactions ou ajoute un échéancier pour suivre cet achat.</span>
        </div>
      )}
    </div>
  );
}
