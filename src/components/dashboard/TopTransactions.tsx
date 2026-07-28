"use client";

import Link from "next/link";
import { Store, ShoppingBag, Repeat, ArrowRight } from "lucide-react";
import { Dot } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format/currency";
import type { DashTx } from "@/lib/dashboard/analysis";

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/**
 * Encart compact des N plus grosses opérations (une ligne par opération : date ·
 * libellé + puces contextuelles · montant aligné à droite) avec un lien « tout
 * afficher » vers le listing filtré. Partagé par les étages du dashboard et
 * l'explorateur de catégories.
 */
export function TopTransactions({ txs, href }: { txs: DashTx[]; href: string }) {
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
      {txs.length === 0 && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", padding: "var(--space-1) 0" }}>
          Aucune opération sur la période.
        </span>
      )}
      <Link href={href} className="btn-ghost-sm" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
        Tout afficher dans le listing
        <ArrowRight size={13} aria-hidden />
      </Link>
    </div>
  );
}
