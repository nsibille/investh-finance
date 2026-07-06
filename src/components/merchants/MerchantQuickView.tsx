"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Store, ArrowRight, Globe } from "lucide-react";
import { formatCurrency } from "@/lib/format/currency";
import { getMerchantQuickStats } from "@/server/actions/merchants";
import type { MerchantStats } from "@/lib/merchants/stats";

const POPOVER_W = 340;

/** "2026-03" → "mars" (abrégé). */
const MONTH_LABELS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];
function monthShort(ym: string): string {
  const m = Number(ym.split("-")[1]);
  return MONTH_LABELS[m - 1] ?? ym;
}

/**
 * Enseigne cliquable dans la liste : ouvre un aperçu (quick view) en lecture
 * seule avec les stats de l'enseigne (dépenses totales, nb de transactions,
 * moyenne mensuelle, 12 derniers mois, top catégories) + un lien vers la fiche.
 * Les stats sont chargées à la demande à la première ouverture.
 */
export function MerchantQuickView({
  merchantId,
  name,
}: {
  merchantId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function reposition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, r.left),
      window.innerWidth - POPOVER_W - 8,
    );
    setCoords({ top: r.bottom + 6, left });
  }

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    reposition();
    setOpen(true);
    if (!stats) {
      setLoading(true);
      const res = await getMerchantQuickStats(merchantId);
      setStats(res);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("keydown", onKey);
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open]);

  const maxMonth = stats
    ? Math.max(1, ...stats.monthly.map((m) => m.depenses))
    : 1;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tx-merchant"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <Store size={13} aria-hidden />
        <span className="tx-merchant__name">{name}</span>
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="mq-popover"
            role="dialog"
            aria-label={`Aperçu de l'enseigne ${name}`}
            style={{ top: coords.top, left: coords.left, width: POPOVER_W }}
          >
            <div className="mq-popover__head">
              <span className="mq-popover__icon"><Store size={16} aria-hidden /></span>
              <div className="mq-popover__title">
                <span className="mq-popover__name">{name}</span>
                {stats && (stats.categoryLabel || stats.isOnline || stats.country) && (
                  <span className="mq-popover__sub">
                    {stats.categoryLabel && (
                      <span className="mq-popover__cat">
                        <span className="badge-dot" style={{ ["--dot-color" as string]: stats.categoryColor ?? undefined }} />
                        {stats.categoryLabel}
                      </span>
                    )}
                    {stats.isOnline ? (
                      <span className="mq-popover__loc"><Globe size={11} aria-hidden /> En ligne</span>
                    ) : stats.country ? (
                      <span className="mq-popover__loc">{stats.country}</span>
                    ) : null}
                  </span>
                )}
              </div>
            </div>

            {loading || !stats ? (
              <div className="mq-popover__loading">Chargement…</div>
            ) : stats.transactionCount === 0 ? (
              <div className="mq-popover__loading">Aucune transaction rattachée.</div>
            ) : (
              <>
                <div className="mq-kpis">
                  <div className="mq-kpi">
                    <span className="mq-kpi__label">Total dépensé</span>
                    <span className="mq-kpi__value">{formatCurrency(stats.totalSpent)}</span>
                  </div>
                  <div className="mq-kpi">
                    <span className="mq-kpi__label">Transactions</span>
                    <span className="mq-kpi__value">{stats.transactionCount}</span>
                  </div>
                  <div className="mq-kpi">
                    <span className="mq-kpi__label">Moy. / mois</span>
                    <span className="mq-kpi__value">{formatCurrency(stats.avgMonthly)}</span>
                  </div>
                </div>

                <div className="mq-section">
                  <span className="mq-section__title">12 derniers mois</span>
                  <div className="mq-bars">
                    {stats.monthly.map((m) => (
                      <div
                        key={m.month}
                        className="mq-bars__col"
                        title={`${monthShort(m.month)} : ${formatCurrency(m.depenses)}`}
                      >
                        <div className="mq-bars__track">
                          <div
                            className="mq-bars__fill"
                            style={{ height: `${Math.round((m.depenses / maxMonth) * 100)}%` }}
                          />
                        </div>
                        <span className="mq-bars__label">{monthShort(m.month).slice(0, 1)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {stats.categories.length > 0 && (
                  <div className="mq-section">
                    <span className="mq-section__title">Catégories</span>
                    <div className="mq-cats">
                      {stats.categories.slice(0, 4).map((c) => (
                        <div key={c.key} className="mq-cat">
                          <span className="badge-dot" style={{ ["--dot-color" as string]: c.color ?? undefined }} />
                          <span className="mq-cat__name">{c.label}</span>
                          <span className="mq-cat__count">{c.count}</span>
                          <span className="mq-cat__amount">{formatCurrency(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <Link href={`/enseignes/${merchantId}`} className="mq-popover__link">
              Voir la fiche de l&apos;enseigne
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}
