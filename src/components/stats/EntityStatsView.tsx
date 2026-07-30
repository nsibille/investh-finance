"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Store,
  Tags,
  Globe,
  MapPin,
  ArrowRight,
  Settings2,
  Receipt,
  TrendingUp,
  Wallet,
  ShoppingBag,
  CalendarClock,
  PieChart,
  Sparkles,
  ChevronLeft,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthZoomSelector } from "@/components/dashboard/MonthZoomSelector";
import { EntityTimelineChart } from "@/components/ui/charts/lazy";
import type { TimelinePoint } from "@/components/ui/charts/EntityTimelineChart";
import { formatCurrency } from "@/lib/format/currency";
import type { EntityStats } from "@/lib/stats/entity";

const MONTHS_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
function monthYearLong(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_LONG[Number(m) - 1] ?? m} ${y}`;
}
function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function signedPct(v: number): string {
  return `${v > 0 ? "+" : ""}${Math.round(v)} %`;
}

function KpiTile({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="mdx-kpi">
      <span className="mdx-kpi__icon" style={accent ? { color: accent } : undefined}>
        {icon}
      </span>
      <div className="mdx-kpi__body">
        <span className="mdx-kpi__label">{label}</span>
        <span className="mdx-kpi__value">{value}</span>
        {hint && <span className="mdx-kpi__hint">{hint}</span>}
      </div>
    </div>
  );
}

/**
 * Écran de statistiques d'une ENTITÉ (enseigne ou catégorie) — composant unique
 * et identique pour les deux : KPIs, fun facts, projections, poids dans les
 * parents, timeline année glissante avec zoom mensuel et look-through (clic sur
 * une barre → détail des opérations), ventilation empilée. Tout ce qui distingue
 * une enseigne d'une catégorie vient de la donnée (`EntityStats`) : libellés,
 * parents, icône (`kind`), navigation. Reflète le zoom via `?zoom=` de l'URL.
 */
export function EntityStatsView({ stats }: { stats: EntityStats }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Jour sélectionné dans la vue zoomée (look-through au 2ᵉ niveau).
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Ligne de répartition dont l'aperçu des 10 opérations est déplié.
  const [openRow, setOpenRow] = useState<string | null>(null);

  const {
    kind,
    name,
    categoryLabel,
    categoryColor,
    isOnline,
    country,
    isIncome,
    total,
    counterTotal,
    transactionCount,
    purchaseCount,
    firstDate,
    maxFlow,
    avgMonthly,
    basket,
    frequency,
    months,
    monthLabels,
    zoomMonth,
    scopeFrom,
    scopeTo,
    monthly,
    scopeTotal,
    scopeCount,
    daily,
    scopeTransactions,
    scopeCategories,
    breakdownTitle,
    weights,
    parents,
    projection,
    nav,
  } = stats;

  const EntityIcon = kind === "category" ? Tags : Store;
  const entityNoun = kind === "category" ? "catégorie" : "enseigne";
  const accent = isIncome ? "var(--color-finance-revenus)" : "var(--color-finance-depenses)";
  const flowNoun = isIncome ? "perçu" : "dépensé";
  const flowLabel = isIncome ? "Revenus" : "Dépenses";
  const scopeLabel = zoomMonth ? monthYearLong(zoomMonth) : "12 derniers mois";

  // Cible de drill d'un enfant de la répartition : sa fiche stats + sa query de
  // listing filtré. Dépend du niveau courant (enseigne→catégorie, catégorie→
  // sous-catégorie, sous-catégorie→enseigne).
  function childLink(childId: string): { stats: string; list: string } {
    if (kind === "merchant") return { stats: `/categories/${childId}`, list: `category=${childId}` };
    if (kind === "category") return { stats: `/categories/sub/${childId}`, list: `subcategory=${childId}` };
    return { stats: `/enseignes/${childId}`, list: `merchant=${childId}` };
  }

  // Timeline : mensuelle (année) ou journalière (mois zoomé). En vue année, on
  // empile les parents cumulés pour visualiser la ventilation de l'entité.
  const timelineData: TimelinePoint[] = useMemo(() => {
    if (zoomMonth && daily) {
      return daily.map((d) => ({
        key: d.date,
        label: String(d.day),
        sub: monthYearLong(zoomMonth),
        amount: d.amount,
        count: d.count,
      }));
    }
    return monthly.map((m, i) => {
      let prev = m.amount;
      const rests: number[] = [];
      for (const p of parents) {
        const val = p.monthly[i] ?? prev;
        rests.push(Math.max(0, val - prev));
        prev = val;
      }
      return {
        key: m.month,
        label: m.label,
        sub: String(m.year),
        amount: m.amount,
        count: m.count,
        rests,
      };
    });
  }, [zoomMonth, daily, monthly, parents]);

  // Empilement des parents activé en vue année quand il y a un « reste » à montrer.
  const stack = useMemo(() => {
    if (zoomMonth || parents.length === 0) return undefined;
    const hasRest = timelineData.some((d) => (d.rests ?? []).some((r) => r > 0.005));
    return hasRest ? { levels: parents.map((p) => ({ label: `Reste ${p.label}` })) } : undefined;
  }, [zoomMonth, parents, timelineData]);

  // Moyenne repère de la timeline.
  const timelineAvg = useMemo(() => {
    const active = timelineData.filter((d) => d.amount > 0);
    if (active.length === 0) return 0;
    return active.reduce((s, d) => s + d.amount, 0) / active.length;
  }, [timelineData]);

  function setZoom(next: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set("zoom", next);
    else sp.delete("zoom");
    setSelectedDay(null);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onBarSelect(point: TimelinePoint) {
    if (zoomMonth) {
      // Vue journalière : bascule la sélection du jour (look-through).
      setSelectedDay((prev) => (prev === point.key ? null : point.key));
    } else {
      // Vue année : zoome sur le mois cliqué.
      setZoom(point.key);
    }
  }

  // Liste look-through : opérations de la portée, filtrées au jour si sélectionné.
  const listedTxns = useMemo(
    () =>
      selectedDay
        ? scopeTransactions.filter((t) => t.date === selectedDay)
        : scopeTransactions,
    [scopeTransactions, selectedDay],
  );

  // Fun facts candidats (les plus parlants d'abord).
  const funFacts = useMemo(() => {
    const out: { emoji: string; text: string }[] = [];
    if (maxFlow) {
      out.push({
        emoji: "💥",
        text: `${isIncome ? "Plus gros revenu" : "Plus grosse dépense"} : ${formatCurrency(maxFlow.amount)} le ${dmy(maxFlow.date)}.`,
      });
    }
    const record = monthly.reduce<(typeof monthly)[number] | null>(
      (best, m) => (m.amount > (best?.amount ?? 0) ? m : best),
      null,
    );
    if (record && record.amount > 0) {
      out.push({
        emoji: "🗓️",
        text: `Mois record : ${monthYearLong(record.month)} (${formatCurrency(record.amount)}).`,
      });
    }
    for (const w of weights) {
      out.push({
        emoji: w.scope === "Type" ? "🌐" : "🏆",
        text: `Pèse ${Math.round(w.pct)} % de « ${w.label} » (${w.scope.toLowerCase()}) sur l'année.`,
      });
    }
    if (frequency >= 1) {
      out.push({
        emoji: "🔁",
        text: `Environ ${frequency.toFixed(1)} opération${frequency >= 2 ? "s" : ""} par mois actif.`,
      });
    }
    if (projection?.trendPct != null && Math.abs(projection.trendPct) >= 10) {
      const up = projection.trendPct > 0;
      out.push({
        emoji: up ? "📈" : "📉",
        text: `Tendance ${up ? "en hausse" : "en baisse"} : ${signedPct(projection.trendPct)} sur le dernier trimestre.`,
      });
    }
    if (firstDate) {
      out.push({
        emoji: "🤝",
        text: `Première opération le ${dmy(firstDate)} — déjà ${transactionCount} au total.`,
      });
    }
    if (!isIncome && counterTotal > 0.01) {
      out.push({
        emoji: "↩️",
        text: `${formatCurrency(counterTotal)} te sont revenus (remboursements / avoirs).`,
      });
    }
    return out;
  }, [
    maxFlow, isIncome, monthly, weights, frequency,
    projection, firstDate, transactionCount, counterTotal,
  ]);

  const maxCat = Math.max(1, ...scopeCategories.map((c) => c.amount));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* En-tête identité */}
      <Card>
        <div className="mdx-header">
          <div className="mdx-header__id">
            <span className="merchant-detail__icon"><EntityIcon size={22} aria-hidden /></span>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: "var(--text-2xl)", margin: 0 }}>{name}</h1>
              <div className="mdx-header__meta">
                {categoryLabel && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span className="badge-dot" style={{ ["--dot-color" as string]: categoryColor ?? undefined }} />
                    {categoryLabel}
                  </span>
                )}
                {isOnline ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Globe size={13} aria-hidden /> En ligne
                  </span>
                ) : country ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={13} aria-hidden /> {country}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <Link href={nav.manageHref} className="btn-secondary-md" style={{ textDecoration: "none" }}>
            <Settings2 size={14} aria-hidden />
            {nav.manageLabel}
          </Link>
        </div>
      </Card>

      {transactionCount === 0 ? (
        <Card>
          <EmptyState
            icon={EntityIcon}
            title="Aucune transaction"
            description={`Aucune transaction n'est encore rattachée à cette ${entityNoun}.`}
          />
        </Card>
      ) : (
        <>
          {/* Zoom (année glissante / mois) */}
          <div className="mdx-zoombar">
            <span className="mdx-zoombar__label">
              <CalendarClock size={14} aria-hidden /> Période
            </span>
            <MonthZoomSelector months={months} labels={monthLabels} zoom={zoomMonth} />
          </div>

          {/* KPIs de la portée */}
          <div className="mdx-kpis">
            <KpiTile
              icon={<Wallet size={16} />}
              label={`Total ${flowNoun} · ${scopeLabel}`}
              value={formatCurrency(scopeTotal)}
              hint={`${scopeCount} opération${scopeCount > 1 ? "s" : ""}`}
              accent={accent}
            />
            <KpiTile
              icon={<Receipt size={16} />}
              label={isIncome ? "Montant moyen" : "Panier moyen"}
              value={formatCurrency(basket)}
            />
            <KpiTile
              icon={<TrendingUp size={16} />}
              label="Moyenne / mois"
              value={formatCurrency(avgMonthly)}
              hint={`≈ ${frequency.toFixed(1)} op./mois`}
            />
            <KpiTile
              icon={<ShoppingBag size={16} />}
              label="Achats liés"
              value={String(purchaseCount)}
            />
          </div>

          {/* Fun facts */}
          {funFacts.length > 0 && (
            <div className="mdx-funfacts">
              {funFacts.slice(0, 4).map((f, i) => (
                <div key={i} className="mdx-funfact">
                  <span className="mdx-funfact__emoji" aria-hidden>{f.emoji}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Projection */}
          {projection && (
            <Card>
              <div className="mdx-proj">
                <div className="mdx-proj__head">
                  <Sparkles size={16} aria-hidden style={{ color: accent }} />
                  <h2 style={{ fontSize: "var(--text-base)", margin: 0 }}>Projection</h2>
                  <span className="mdx-proj__caption">au rythme de l&apos;année glissante</span>
                </div>
                <div className="mdx-proj__grid">
                  <div className="mdx-proj__item">
                    <span className="mdx-proj__label">Rythme mensuel</span>
                    <span className="mdx-proj__value">{formatCurrency(projection.runRate)}</span>
                  </div>
                  <div className="mdx-proj__item">
                    <span className="mdx-proj__label">Estimation mois prochain</span>
                    <span className="mdx-proj__value">{formatCurrency(projection.nextMonth)}</span>
                  </div>
                  <div className="mdx-proj__item">
                    <span className="mdx-proj__label">Projeté sur 12 mois</span>
                    <span className="mdx-proj__value">{formatCurrency(projection.year)}</span>
                  </div>
                  <div className="mdx-proj__item">
                    <span className="mdx-proj__label">Tendance (trimestre)</span>
                    <span
                      className="mdx-proj__value"
                      style={{
                        color:
                          projection.trendPct == null
                            ? undefined
                            : projection.trendPct > 0
                              ? (isIncome ? "var(--color-finance-revenus)" : "var(--color-finance-depenses)")
                              : (isIncome ? "var(--color-finance-depenses)" : "var(--color-finance-revenus)"),
                      }}
                    >
                      {projection.trendPct == null ? "—" : signedPct(projection.trendPct)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Poids relatif dans les parents */}
          {weights.length > 0 && (
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div className="mdx-section__head">
                  <h2 style={{ fontSize: "var(--text-base)", margin: 0, display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <PieChart size={16} aria-hidden style={{ color: accent }} />
                    Poids relatif · 12 mois
                  </h2>
                </div>
                <p className="mdx-hint">Part de cette {entityNoun} dans chacun de ses parents.</p>
                <div className="mdx-weights">
                  {weights.map((w) => (
                    <div key={w.scope} className="mdx-weight">
                      <div className="mdx-weight__head">
                        <span className="mdx-weight__scope">{w.scope}</span>
                        <span className="mdx-weight__label" title={w.label}>{w.label}</span>
                        <span className="mdx-weight__pct">{Math.round(w.pct)} %</span>
                      </div>
                      <div className="mdx-weight__track">
                        <div
                          className="mdx-weight__fill"
                          style={{ width: `${Math.min(100, Math.round(w.pct))}%`, background: accent }}
                        />
                      </div>
                      <span className="mdx-weight__total">
                        {formatCurrency(w.total)} au total pour {w.scope === "Type" ? "le type" : "la catégorie"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Timeline avec look-through */}
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div className="mdx-section__head">
                <h2 style={{ fontSize: "var(--text-base)", margin: 0 }}>
                  {flowLabel} · {zoomMonth ? `jour par jour — ${monthYearLong(zoomMonth)}` : "année glissante"}
                </h2>
                {zoomMonth && (
                  <button type="button" className="mdx-linkbtn" onClick={() => setZoom(null)}>
                    <ChevronLeft size={14} aria-hidden /> Revenir à l&apos;année
                  </button>
                )}
              </div>
              <p className="mdx-hint">
                {zoomMonth
                  ? "Clique un jour pour filtrer les opérations ci-dessous."
                  : stack
                    ? `Part colorée = cette ${entityNoun} ; empilé au-dessus, le reste de ses parents. Clique un mois pour zoomer.`
                    : "Clique un mois pour zoomer et voir le détail des opérations."}
              </p>
              <EntityTimelineChart
                data={timelineData}
                average={stack ? 0 : timelineAvg}
                valueLabel={flowLabel}
                accent={accent}
                selectedKey={selectedDay}
                stack={stack}
                onSelect={onBarSelect}
              />
            </div>
          </Card>

          {/* Répartition par enfants (portée) — chaque ligne est drillable */}
          {scopeCategories.length > 1 && (
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <h2 style={{ fontSize: "var(--text-base)", margin: 0 }}>
                  Répartition par {breakdownTitle} · {scopeLabel}
                </h2>
                <p className="mdx-hint">
                  Clique un nom pour ses stats, l&apos;icône pour l&apos;aperçu des 10 opérations.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {scopeCategories.map((c) => {
                    const pctScope = scopeTotal > 0 ? Math.round((c.amount / scopeTotal) * 100) : 0;
                    const link = c.id ? childLink(c.id) : null;
                    const open = openRow === c.key;
                    return (
                      <div key={c.key} className="md-cat">
                        <div className="md-cat__head">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
                            <span className="badge-dot" style={{ ["--dot-color" as string]: c.color ?? undefined }} />
                            {link ? (
                              <Link href={link.stats} className="link-plain md-cat__name" title={`Statistiques · ${c.label}`}>
                                {c.label}
                              </Link>
                            ) : (
                              <span className="md-cat__name">{c.label}</span>
                            )}
                            <span className="mq-cat__count">{c.count}</span>
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
                              {formatCurrency(c.amount)} · {pctScope} %
                            </span>
                            <IconButton
                              label="Aperçu des 10 opérations"
                              data-on={open || undefined}
                              onClick={() => setOpenRow(open ? null : c.key)}
                            >
                              <ReceiptIcon size={15} />
                            </IconButton>
                          </span>
                        </div>
                        <div className="md-cat__track">
                          <div className="md-cat__fill" style={{ width: `${Math.round((c.amount / maxCat) * 100)}%`, background: c.color ?? "var(--color-brand-primary)" }} />
                        </div>
                        {open && (
                          <div className="mdx-rowdrill">
                            {(c.top ?? []).length === 0 ? (
                              <p className="mdx-hint">Aucune opération sur la période.</p>
                            ) : (
                              <div className="mdx-txns">
                                {(c.top ?? []).map((t) => (
                                  <div key={t.id} className="mdx-txn">
                                    <span className="mdx-txn__date">{dmy(t.date)}</span>
                                    <span className="mdx-txn__label" title={t.label}>{t.label}</span>
                                    {t.categoryLabel && (
                                      <span className="mdx-txn__cat">
                                        <span className="badge-dot" style={{ ["--dot-color" as string]: t.categoryColor ?? undefined }} />
                                        {t.categoryLabel}
                                      </span>
                                    )}
                                    <span className={`mdx-txn__amount ${t.amount >= 0 ? "amount-positive" : "amount-negative"}`}>
                                      {formatCurrency(t.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {link && (
                              <Link
                                href={`/transactions?${link.list}&from=${scopeFrom}&to=${scopeTo}`}
                                className="btn-ghost-sm"
                                style={{ alignSelf: "flex-start", textDecoration: "none" }}
                              >
                                Tout afficher dans le listing
                                <ArrowRight size={13} aria-hidden />
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Look-through : opérations de la portée */}
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div className="mdx-section__head">
                <h2 style={{ fontSize: "var(--text-base)", margin: 0 }}>
                  Opérations · {selectedDay ? dmy(selectedDay) : scopeLabel}
                </h2>
                {selectedDay && (
                  <button type="button" className="mdx-linkbtn" onClick={() => setSelectedDay(null)}>
                    Tout le mois
                  </button>
                )}
              </div>
              {listedTxns.length === 0 ? (
                <p className="mdx-hint">Aucune opération sur cette période.</p>
              ) : (
                <div className="mdx-txns">
                  {listedTxns.map((t) => (
                    <div key={t.id} className="mdx-txn">
                      <span className="mdx-txn__date">{dmy(t.date)}</span>
                      <span className="mdx-txn__label" title={t.label}>{t.label}</span>
                      {t.categoryLabel && (
                        <span className="mdx-txn__cat">
                          <span className="badge-dot" style={{ ["--dot-color" as string]: t.categoryColor ?? undefined }} />
                          {t.categoryLabel}
                        </span>
                      )}
                      <span className={`mdx-txn__amount ${t.amount >= 0 ? "amount-positive" : "amount-negative"}`}>
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href={`/transactions?${nav.listQuery}&from=${scopeFrom}&to=${scopeTo}`}
                className="btn-secondary-md"
                style={{ textDecoration: "none", alignSelf: "flex-start" }}
              >
                Voir dans le listing complet
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </Card>

          {/* Total cumulé (toute la période) en pied */}
          <p className="mdx-alltime">
            Depuis le début : <strong>{formatCurrency(total)}</strong> {flowNoun} sur{" "}
            {transactionCount} opération{transactionCount > 1 ? "s" : ""}.
          </p>
        </>
      )}
    </div>
  );
}
