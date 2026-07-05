"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Scale, Gift, HandCoins, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/format/currency";
import { setTransactionShares } from "@/server/actions/persons";
import type {
  PersonOption,
  TransactionSplit,
  SplitNature,
} from "@/lib/persons/types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Répartit `total` en `n` parts égales (le reste au centime va à la 1re part). */
function equalShares(total: number, n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor((total / n) * 100) / 100;
  const parts = new Array(n).fill(each);
  parts[0] = round2(total - each * (n - 1));
  return parts;
}

/**
 * Éditeur de ventilation d'une transaction entre personnes.
 * - « Moi » coché par défaut, décochable.
 * - Répartition équitable auto (bouton), chaque part restant éditable.
 * - Nature globale dette / cadeau (les parts des autres = créance ou cadeau).
 * Slug design system : `person-share-editor`.
 */
export function PersonSharePicker({
  transactionId,
  amount,
  currency,
  persons,
  initial,
}: {
  transactionId: string;
  amount: number;
  currency: string;
  persons: PersonOption[];
  initial: TransactionSplit;
}) {
  const router = useRouter();
  const toast = useToast();
  const total = round2(Math.abs(amount));

  const selfId = useMemo(
    () => persons.find((p) => p.isSelf)?.id ?? null,
    [persons],
  );

  const [nature, setNature] = useState<SplitNature>(initial.nature ?? "debt");
  const [saving, setSaving] = useState(false);

  // État initial : parts existantes, sinon « moi » seul avec le montant total.
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (initial.shares.length > 0)
      return new Set(initial.shares.map((s) => s.personId));
    return new Set(selfId ? [selfId] : []);
  });
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    if (initial.shares.length > 0) {
      return Object.fromEntries(
        initial.shares.map((s) => [s.personId, String(s.amount)]),
      );
    }
    return selfId ? { [selfId]: String(total) } : {};
  });

  const checkedIds = persons.filter((p) => checked.has(p.id)).map((p) => p.id);

  function redistribute(ids: string[]) {
    const parts = equalShares(total, ids.length);
    setAmounts(Object.fromEntries(ids.map((id, i) => [id, String(parts[i])])));
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      redistribute(persons.filter((p) => next.has(p.id)).map((p) => p.id));
      return next;
    });
  }

  const parsed = useMemo(() => {
    const map = new Map<string, number>();
    for (const id of checkedIds) {
      const v = parseFloat((amounts[id] ?? "").replace(",", "."));
      map.set(id, Number.isFinite(v) ? Math.max(0, v) : 0);
    }
    return map;
  }, [checkedIds, amounts]);

  const sumShares = [...parsed.values()].reduce((s, v) => s + v, 0);
  const othersSum = checkedIds
    .filter((id) => id !== selfId)
    .reduce((s, id) => s + (parsed.get(id) ?? 0), 0);
  const myShare = selfId ? (parsed.get(selfId) ?? 0) : 0;
  const mismatch = Math.abs(sumShares - total) > 0.01;

  async function save() {
    setSaving(true);
    const res = await setTransactionShares(transactionId, {
      nature,
      shares: checkedIds.map((id) => ({ personId: id, amount: parsed.get(id) ?? 0 })),
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(checkedIds.length ? "Partage enregistré" : "Partage retiré");
    router.refresh();
  }

  const natureBtn = (
    value: SplitNature,
    label: string,
    Icon: typeof Gift,
  ) => (
    <button
      type="button"
      onClick={() => setNature(value)}
      data-active={nature === value}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: 32,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        background:
          nature === value ? "var(--color-brand-primary-50)" : "var(--color-bg-surface)",
        color:
          nature === value
            ? "var(--color-brand-primary-700)"
            : "var(--color-text-secondary)",
        borderColor:
          nature === value ? "var(--color-brand-primary)" : "var(--color-border)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        cursor: "pointer",
      }}
    >
      <Icon size={15} aria-hidden />
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {persons.length === 0 ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
          Aucune personne. Crée-en une dans « Personnes » pour partager cette transaction.
        </p>
      ) : (
        <>
          {/* Personnes cochables */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {persons.map((p) => {
              const isChecked = checked.has(p.id);
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    justifyContent: "space-between",
                  }}
                >
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      fontSize: "var(--text-sm)",
                      cursor: "pointer",
                    }}
                  >
                    <Checkbox checked={isChecked} onChange={() => toggle(p.id)} />
                    <Dot color={p.color} />
                    {p.name}
                    {p.isSelf && (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        (moi)
                      </span>
                    )}
                  </label>
                  {isChecked && (
                    <div style={{ width: 120 }}>
                      <Input
                        value={amounts[p.id] ?? ""}
                        inputMode="decimal"
                        onChange={(e) =>
                          setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions répartition + nature */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Scale size={15} />}
              onClick={() => redistribute(checkedIds)}
              disabled={checkedIds.length === 0}
            >
              Répartir équitablement
            </Button>
            <div style={{ flex: 1 }} />
            {natureBtn("debt", "Dette", HandCoins)}
            {natureBtn("gift", "Cadeau", Gift)}
          </div>

          {/* Résumé */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1)",
              padding: "var(--space-3)",
              background: "var(--color-bg-subtle)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Ma part</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(myShare, currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-text-muted)" }}>
                {nature === "debt" ? "Créances (à te rembourser)" : "Cadeaux offerts"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(othersSum, currency)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: mismatch ? "var(--color-warning-dark)" : "var(--color-text-muted)",
              }}
            >
              <span>Total réparti / transaction</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {formatCurrency(sumShares, currency)} / {formatCurrency(total, currency)}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
            {initial.shares.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<RotateCcw size={15} />}
                onClick={() => {
                  setChecked(new Set());
                  setAmounts({});
                }}
              >
                Ne pas partager
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              size="sm"
              leftIcon={<Users size={15} />}
              loading={saving}
              onClick={save}
            >
              Enregistrer le partage
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
