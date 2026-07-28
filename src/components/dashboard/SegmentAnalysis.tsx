"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Lightbulb,
  Store,
  ShoppingBag,
  Repeat,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Dot } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format/currency";
import { SEGMENT_LABEL } from "@/lib/dashboard/segments";
import type { DashSegment, DashCategory, DashTx } from "@/lib/dashboard/analysis";

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function Delta({ pct, goodWhenUp }: { pct: number | null; goodWhenUp: boolean }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const tone = Math.abs(pct) < 1 ? "flat" : up === goodWhenUp ? "good" : "bad";
  return (
    <span className="seg-delta" data-tone={tone} title="vs mois précédent">
      {up ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
      {up ? "+" : "−"}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Sparkline({ monthly, refIndex }: { monthly: number[]; refIndex: number }) {
  const max = Math.max(1, ...monthly);
  return (
    <span className="seg-spark" aria-hidden>
      {monthly.map((v, i) => (
        <span
          key={i}
          className="seg-spark__bar"
          data-ref={i === refIndex || undefined}
          style={{ height: `${Math.max(2, Math.round((v / max) * 20))}px` }}
        />
      ))}
    </span>
  );
}

function DrillRows({ txs, href }: { txs: DashTx[]; href: string }) {
  return (
    <div className="seg-drill">
      {txs.map((t) => (
        <div className="seg-drill__row" key={t.id}>
          <span className="seg-drill__date">{dmy(t.date)}</span>
          <span className="seg-drill__body">
            <span className="seg-drill__label">{t.label}</span>
            {t.subName && (
              <span className="seg-chip">
                <Dot color={t.categoryColor ?? undefined} />
                {t.subName}
              </span>
            )}
            {t.merchant && (
              <span className="seg-chip">
                <Store size={11} aria-hidden />
                {t.merchant}
              </span>
            )}
            {t.purchase && (
              <span className="seg-chip seg-chip--purchase">
                <ShoppingBag size={11} aria-hidden />
                {t.purchase}
              </span>
            )}
            {t.recurring && (
              <span className="seg-chip">
                <Repeat size={11} aria-hidden />
                {t.recurring}
              </span>
            )}
          </span>
          <span
            className="seg-drill__amount"
            style={{ color: t.amount >= 0 ? "var(--color-success)" : undefined }}
          >
            {formatCurrency(t.amount)}
          </span>
        </div>
      ))}
      <Link href={href} className="btn-ghost-sm" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
        Tout afficher dans le listing
        <ArrowRight size={13} aria-hidden />
      </Link>
    </div>
  );
}

/**
 * Étage d'analyse d'un segment (revenus / dépenses fixes / variables /
 * investissements) : total + variation, moyenne, fun facts, décomposition par
 * catégorie (sparkline 12 mois, variation, part) avec drill-down des 10 plus
 * grosses opérations et liens « tout afficher » (filtres appliqués) vers le
 * listing.
 */
export function SegmentAnalysis({
  segment,
  accent,
  goodWhenUp,
  refIndex,
  from,
  to,
  segmentFilter,
}: {
  segment: DashSegment;
  accent: string; // couleur d'accent (var CSS)
  goodWhenUp: boolean;
  refIndex: number;
  from: string;
  to: string;
  segmentFilter: { flow?: string; types?: string[] };
}) {
  const [open, setOpen] = useState<string | null>(null);

  function href(extra: Record<string, string>): string {
    const sp = new URLSearchParams({ from, to, ...extra });
    return `/transactions?${sp.toString()}`;
  }
  const segmentHref = href(
    segmentFilter.flow
      ? { flow: segmentFilter.flow }
      : { types: (segmentFilter.types ?? []).join(",") },
  );
  const total = segment.total;

  return (
    <Card>
      <div className="seg-analysis">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ width: 10, height: 10, borderRadius: "var(--radius-full)", background: accent }} aria-hidden />
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--fw-semibold)", margin: 0 }}>
                {SEGMENT_LABEL[segment.key]}
              </h2>
              <Delta pct={segment.changePct} goodWhenUp={goodWhenUp} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginTop: "var(--space-1)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xl)", fontWeight: "var(--fw-semibold)" }}>
                {formatCurrency(total)}
              </span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                moy. {formatCurrency(segment.avgMonthly)}/mois · {segment.count} opération{segment.count > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <Link href={segmentHref} className="btn-secondary-md" style={{ textDecoration: "none" }}>
            Voir les {segment.count} opérations
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>

        {segment.funFacts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {segment.funFacts.map((f, i) => (
              <span
                key={i}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", background: "var(--color-bg-subtle)", padding: "4px 10px", borderRadius: "var(--radius-full)" }}
              >
                <Lightbulb size={12} aria-hidden style={{ color: "var(--color-warning, var(--color-text-muted))" }} />
                {f}
              </span>
            ))}
          </div>
        )}

        {segment.categories.length === 0 ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
            Aucune opération sur la période.
          </p>
        ) : (
          <div className="seg-cats">
            {segment.categories.map((c: DashCategory) => {
              const isOpen = open === c.categoryId;
              const share = total > 0 ? Math.round((c.total / total) * 100) : 0;
              return (
                <div className="seg-cat" key={c.categoryId}>
                  <div className="seg-cat__head">
                    <button
                      type="button"
                      aria-label={isOpen ? "Replier" : "Voir les 10 plus grosses"}
                      onClick={() => setOpen(isOpen ? null : c.categoryId)}
                      className="btn-icon-md"
                      style={{ width: 24, height: 24 }}
                    >
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <span className="badge-dot" style={{ ["--dot-color" as string]: c.color ?? undefined }} aria-hidden />
                    <span className="seg-cat__name">{c.name}</span>
                    <span className="seg-cat__count">{c.count}×</span>
                    <Delta pct={c.changePct} goodWhenUp={goodWhenUp} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <Sparkline monthly={c.monthly} refIndex={refIndex} />
                    <span className="seg-cat__amount">
                      {formatCurrency(c.total)}
                      <span style={{ color: "var(--color-text-muted)", fontWeight: "var(--fw-regular)" }}> · {share}%</span>
                    </span>
                  </div>
                  <div className="seg-cat__bar">
                    <div className="seg-cat__bar-fill" style={{ width: `${share}%`, background: c.color ?? "var(--color-brand-primary)" }} />
                  </div>
                  {isOpen && <DrillRows txs={c.topTransactions} href={href({ category: c.categoryId })} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
