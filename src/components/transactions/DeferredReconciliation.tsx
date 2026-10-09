"use client";

import { useState } from "react";
import { ChevronDown, CreditCard } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dot } from "@/components/ui/Badge";
import { formatShortDate, formatMonthLabel } from "@/lib/format/date";
import { formatCurrency } from "@/lib/format/currency";
import {
  DEFERRED_TOLERANCE,
  type DeferredReconciliation as Reconciliation,
  type DeferredAccountReconciliation,
  type DeferredMonth,
  type DeferredMonthStatus,
} from "@/lib/transactions/deferredReconciliation";

const STATUS_LABEL: Record<DeferredMonthStatus, string> = {
  ok: "Concordant",
  gap: "Écart",
  missing: "Prélèvement manquant",
  open: "En cours",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function MonthRow({ m, currency }: { m: DeferredMonth; currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="deferred-month" data-status={m.status}>
      <button
        type="button"
        className="deferred-month__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronDown
          size={16}
          aria-hidden
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform var(--transition-fast)", flexShrink: 0 }}
        />
        <span className="deferred-month__label">{formatMonthLabel(`${m.month}-01`)}</span>
        <span className="deferred-month__status">{STATUS_LABEL[m.status]}</span>
        <span className="deferred-month__figures">
          <span className="deferred-month__figure">
            <span className="deferred-month__caption">{plural(m.ops.length, "paiement")}</span>
            <Amount value={m.opsTotal} currency={currency} size="sm" tone="neutral" />
          </span>
          <span className="deferred-month__figure">
            <span className="deferred-month__caption">Prélevé</span>
            {m.debits.length > 0 ? (
              <Amount value={m.debitTotal} currency={currency} size="sm" tone="neutral" />
            ) : (
              <span className="deferred-month__none">—</span>
            )}
          </span>
          <span className="deferred-month__figure">
            <span className="deferred-month__caption">Écart</span>
            {m.status === "ok" || m.status === "gap" ? (
              <span className="deferred-month__gap">
                {formatCurrency(m.gap, currency)}
              </span>
            ) : (
              <span className="deferred-month__none">—</span>
            )}
          </span>
        </span>
      </button>
      {open && (
        <div className="deferred-month__body">
          {m.debits.map((d) => (
            <div className="deferred-line" data-debit key={d.id}>
              <span className="deferred-line__date">{formatShortDate(d.operation_date)}</span>
              <code className="tx-label-code">{d.label}</code>
              <Amount value={d.amount} currency={currency} size="sm" />
            </div>
          ))}
          {m.ops.length === 0 ? (
            <p className="transfer-orphan__none">Aucun paiement carte ce mois-ci.</p>
          ) : (
            m.ops.map((o) => (
              <div className="deferred-line" key={o.id}>
                <span className="deferred-line__date">{formatShortDate(o.operation_date)}</span>
                <code className="tx-label-code">{o.label}</code>
                <Amount value={o.amount} currency={currency} size="sm" />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AccountBlock({ a }: { a: DeferredAccountReconciliation }) {
  const unexplained = Math.round((a.gapTotal + a.missingTotal) * 100) / 100;
  const balanced = Math.abs(unexplained) < DEFERRED_TOLERANCE;
  const missing = a.months.filter((m) => m.status === "missing").length;
  const gaps = a.months.filter((m) => m.status === "gap").length;
  const ok = a.months.filter((m) => m.status === "ok").length;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* — Calcul final — */}
      <div className="transfer-balance" data-balanced={balanced || undefined}>
        <div className="transfer-balance__head">
          <span className="transfer-balance__label" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Dot color={a.account.color ?? undefined} />
            {a.account.name} — écart non expliqué
          </span>
          <span className="transfer-balance__value">
            {formatCurrency(unexplained, a.currency)}
          </span>
        </div>
        <p className="transfer-balance__hint">
          {balanced
            ? "Tout est pris en compte : chaque mois de paiements carte a été prélevé pour le bon montant."
            : missing > 0
              ? `${plural(missing, "mois")} sans prélèvement et ${plural(gaps, "mois")} en écart : le total des paiements ne correspond pas aux prélèvements.`
              : `${plural(gaps, "mois")} en écart : le total des paiements ne correspond pas exactement aux prélèvements.`}
        </p>
        <div className="deferred-check">
          <span>Paiements carte</span>
          <Amount value={a.opsTotal} currency={a.currency} size="sm" tone="neutral" />
          <span>= Prélevés</span>
          <Amount value={a.debitTotal} currency={a.currency} size="sm" tone="neutral" />
          <span>+ En cours</span>
          <Amount value={a.pending} currency={a.currency} size="sm" tone="neutral" />
          <span>+ Non prélevés</span>
          <Amount value={a.missingTotal} currency={a.currency} size="sm" tone="neutral" />
          <span>+ Écarts</span>
          <span className="deferred-check__gap">{formatCurrency(a.gapTotal, a.currency)}</span>
        </div>
        <div className="transfer-balance__stats">
          <span>
            <strong>{ok}</strong> concordant{ok > 1 ? "s" : ""}
          </span>
          <span data-alert={gaps > 0 || undefined}>
            <strong>{gaps}</strong> en écart
          </span>
          <span data-alert={missing > 0 || undefined}>
            <strong>{missing}</strong> manquant{missing > 1 ? "s" : ""}
          </span>
          {a.before.count > 0 && (
            <span>
              <strong>{a.before.count}</strong> paiement{a.before.count > 1 ? "s" : ""} avant le 1ᵉʳ prélèvement connu (hors contrôle)
            </span>
          )}
        </div>
      </div>

      {/* — Détail par mois — */}
      {a.months.length === 0 ? (
        <p className="transfer-orphan__none">
          Aucun prélèvement « débit différé » trouvé sur ce compte.
        </p>
      ) : (
        a.months.map((m) => <MonthRow key={m.month} m={m} currency={a.currency} />)
      )}
    </section>
  );
}

export function DeferredReconciliation({ data }: { data: Reconciliation }) {
  if (data.accounts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CreditCard}
          title="Aucun compte à débit différé"
          description="Active « Carte à débit différé » dans les réglages d'un compte pour contrôler ses prélèvements mensuels."
        />
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {data.accounts.map((a) => (
        <AccountBlock key={a.account.id} a={a} />
      ))}
    </div>
  );
}
