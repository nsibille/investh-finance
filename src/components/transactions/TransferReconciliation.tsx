"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Link2,
  Unlink,
  Ban,
  ChevronDown,
  ScrollText,
} from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { formatShortDate } from "@/lib/format/date";
import { formatCurrency } from "@/lib/format/currency";
import {
  pairInternalTransfer,
  unpairInternalTransfer,
  removeFromInternalTransfers,
} from "@/server/actions/transfers";
import type {
  TransferReconciliation as Reconciliation,
  TransferLeg,
  Orphan,
} from "@/lib/transactions/transfersReconciliation";

function Leg({ leg, size = "md" }: { leg: TransferLeg; size?: "sm" | "md" }) {
  return (
    <div className="transfer-leg">
      <div className="transfer-leg__main">
        <code className="tx-label-code">{leg.label}</code>
        <div className="transfer-leg__meta">
          <span>{formatShortDate(leg.operation_date)}</span>
          {leg.account && (
            <span className="transfer-leg__account">
              <Dot color={leg.account.color ?? undefined} />
              {leg.account.name}
            </span>
          )}
        </div>
      </div>
      <Amount value={leg.amount} currency={leg.currency} size={size} />
    </div>
  );
}

export function TransferReconciliation({ data }: { data: Reconciliation }) {
  const router = useRouter();
  const toast = useToast();
  const [pairFor, setPairFor] = useState<Orphan | null>(null);
  const [hiddenCandidates, setHiddenCandidates] = useState<Set<string>>(new Set());
  const [hiddenOrphans, setHiddenOrphans] = useState<Set<string>>(new Set());
  const [hiddenPairs, setHiddenPairs] = useState<Set<string>>(new Set());
  const [showPairs, setShowPairs] = useState(false);

  const orphans = useMemo(
    () => data.orphans.filter((o) => !hiddenOrphans.has(o.leg.id)),
    [data.orphans, hiddenOrphans],
  );
  const candidates = useMemo(
    () =>
      data.candidates.filter(
        (c) => !hiddenCandidates.has(`${c.outLeg.id}:${c.inLeg.id}`),
      ),
    [data.candidates, hiddenCandidates],
  );
  const pairs = useMemo(
    () => data.pairs.filter((p) => !hiddenPairs.has(p.groupId)),
    [data.pairs, hiddenPairs],
  );

  if (!data.internalSubcategoryId) {
    return (
      <Card>
        <EmptyState
          icon={ScrollText}
          title="Catégorie « Virement interne » absente"
          description="Crée la catégorie pour activer la réconciliation des virements internes."
        />
      </Card>
    );
  }

  const balanced = Math.abs(data.balance) < 0.005 && orphans.length === 0;

  async function pair(a: string, b: string, onDone: () => void) {
    const res = await runOptimistic({
      apply: onDone,
      rollback: () => {},
      run: () => pairInternalTransfer(a, b),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success("Virement interne apparié");
      router.refresh();
    }
  }

  async function unpair(groupId: string) {
    const res = await runOptimistic({
      apply: () => setHiddenPairs((s) => new Set(s).add(groupId)),
      rollback: () =>
        setHiddenPairs((s) => {
          const n = new Set(s);
          n.delete(groupId);
          return n;
        }),
      run: () => unpairInternalTransfer(groupId),
      onError: toast.error,
    });
    if (res.ok) {
      toast.info("Paire dissociée");
      router.refresh();
    }
  }

  async function remove(id: string) {
    const res = await runOptimistic({
      apply: () => setHiddenOrphans((s) => new Set(s).add(id)),
      rollback: () =>
        setHiddenOrphans((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        }),
      run: () => removeFromInternalTransfers(id),
      onError: toast.error,
    });
    if (res.ok) {
      toast.info("Retirée des virements — repassée « à valider »");
      router.refresh();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* — Bandeau de solde — */}
      <div className="transfer-balance" data-balanced={balanced || undefined}>
        <div className="transfer-balance__head">
          <span className="transfer-balance__label">
            Solde des virements internes
          </span>
          <span className="transfer-balance__value">
            {formatCurrency(data.balance, data.currency)}
          </span>
        </div>
        <p className="transfer-balance__hint">
          {balanced
            ? "Tout est équilibré : chaque virement interne a bien sa contrepartie."
            : orphans.length > 0
              ? `${orphans.length} virement${orphans.length > 1 ? "s" : ""} interne${orphans.length > 1 ? "s" : ""} sans contrepartie — le total doit revenir à 0.`
              : "Le total des virements internes devrait être 0."}
        </p>
        <div className="transfer-balance__stats">
          <span>
            <strong>{pairs.length}</strong> paire{pairs.length > 1 ? "s" : ""}
          </span>
          <span data-alert={orphans.length > 0 || undefined}>
            <strong>{orphans.length}</strong> orphelin{orphans.length > 1 ? "s" : ""}
          </span>
          <span data-alert={candidates.length > 0 || undefined}>
            <strong>{candidates.length}</strong> candidat{candidates.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* — Orphelins à réconcilier — */}
      {orphans.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <h2 className="transfer-section__title">À réconcilier</h2>
          {orphans.map((o) => (
            <div className="transfer-orphan" key={o.leg.id}>
              <Leg leg={o.leg} />
              <div className="transfer-orphan__actions">
                {o.suggestions.length > 0 ? (
                  <Button
                    size="sm"
                    leftIcon={<Link2 size={14} />}
                    onClick={() => setPairFor(o)}
                  >
                    Apparier
                    <span className="transfer-count">{o.suggestions.length}</span>
                  </Button>
                ) : (
                  <span className="transfer-orphan__none">
                    Aucune contrepartie évidente
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Ban size={14} />}
                  onClick={() => remove(o.leg.id)}
                >
                  Retirer
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* — Candidats non catégorisés — */}
      {candidates.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <h2 className="transfer-section__title">
            Virements internes potentiels
            <span className="transfer-section__sub">
              montants opposés sur deux comptes, pas encore catégorisés
            </span>
          </h2>
          {candidates.map((c) => {
            const key = `${c.outLeg.id}:${c.inLeg.id}`;
            return (
              <div className="transfer-candidate" key={key}>
                <div className="transfer-candidate__legs">
                  <Leg leg={c.outLeg} size="sm" />
                  <ArrowRight size={16} aria-hidden className="transfer-candidate__arrow" />
                  <Leg leg={c.inLeg} size="sm" />
                </div>
                <div className="transfer-orphan__actions">
                  <Button
                    size="sm"
                    leftIcon={<Check size={14} />}
                    onClick={() =>
                      pair(c.outLeg.id, c.inLeg.id, () =>
                        setHiddenCandidates((s) => new Set(s).add(key)),
                      )
                    }
                  >
                    Marquer comme virement interne
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHiddenCandidates((s) => new Set(s).add(key))}
                  >
                    Ignorer
                  </Button>
                </div>
              </div>
            );
          })}
          {data.candidatesTruncated && (
            <p className="transfer-orphan__none">
              Seuls les 100 candidats les plus récents sont affichés.
            </p>
          )}
        </section>
      )}

      {/* — Paires réconciliées — */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <button
          type="button"
          className="transfer-section__toggle"
          onClick={() => setShowPairs((v) => !v)}
          aria-expanded={showPairs}
        >
          <ChevronDown
            size={16}
            aria-hidden
            style={{ transform: showPairs ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform var(--transition-fast)" }}
          />
          Paires réconciliées
          <span className="transfer-count">{pairs.length}</span>
        </button>
        {showPairs &&
          (pairs.length === 0 ? (
            <p className="transfer-orphan__none">Aucune paire réconciliée.</p>
          ) : (
            pairs.map((p) => (
              <div className="transfer-pair" key={p.groupId}>
                <div className="transfer-pair__legs">
                  {p.legs.map((leg) => (
                    <Leg key={leg.id} leg={leg} size="sm" />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Unlink size={14} />}
                  onClick={() => unpair(p.groupId)}
                >
                  Dissocier
                </Button>
              </div>
            ))
          ))}
      </section>

      {orphans.length === 0 && candidates.length === 0 && pairs.length === 0 && (
        <Card>
          <EmptyState
            icon={Check}
            title="Aucun virement interne"
            description="Les virements entre tes comptes apparaîtront ici pour réconciliation."
          />
        </Card>
      )}

      {/* — Modal d'appariement d'un orphelin — */}
      <Modal
        open={pairFor !== null}
        onClose={() => setPairFor(null)}
        title="Choisir la contrepartie"
      >
        {pairFor && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Leg leg={pairFor.leg} />
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              Sélectionne la transaction opposée qui complète ce virement (elle
              sera catégorisée « Virement interne » et validée).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {pairFor.suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="transfer-suggestion"
                  onClick={() =>
                    pair(pairFor.leg.id, s.id, () => {
                      setHiddenOrphans((h) => new Set(h).add(pairFor.leg.id));
                      setPairFor(null);
                    })
                  }
                >
                  <Leg leg={s} size="sm" />
                  {!s.isInternal && (
                    <span className="transfer-suggestion__tag">non catégorisé</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
