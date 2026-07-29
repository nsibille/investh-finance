"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Scale,
  Gift,
  HandCoins,
  RotateCcw,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/format/currency";
import {
  setTransactionShares,
  addRepayment,
  updateRepayment,
  deleteRepayment,
  getTransactionRepayment,
} from "@/server/actions/persons";
import type {
  PersonOption,
  TransactionSplit,
  SplitNature,
  TransactionRepaymentContext,
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

type Mode = "share" | "repayment";

/**
 * Éditeur de lien d'une transaction avec des personnes.
 * - Dépense (montant < 0) : ventilation entre plusieurs personnes
 *   (dette/cadeau, parts éditables).
 * - Crédit (montant > 0) : une seule personne, sans partage —
 *   « À rembourser » (argent reçu que tu dois à la personne → tu lui dois) ou
 *   « Remboursement » (la personne éteint une dette qu'elle avait envers toi).
 * Slug design system : `person-share-editor`.
 */
export function PersonSharePicker({
  transactionId,
  amount,
  currency,
  persons,
  initial,
  onSaved,
}: {
  transactionId: string;
  amount: number;
  currency: string;
  persons: PersonOption[];
  initial: TransactionSplit;
  /** Appelé après un enregistrement réussi (ferme la modale en liste/achat). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const total = round2(Math.abs(amount));
  const isCredit = amount > 0;

  const selfId = useMemo(
    () => persons.find((p) => p.isSelf)?.id ?? null,
    [persons],
  );
  const others = useMemo(() => persons.filter((p) => !p.isSelf), [persons]);

  // Un crédit non encore ventilé bascule par défaut sur « Remboursement » : le
  // cas dominant d'un virement entrant est le remboursement d'une dette.
  const [mode, setMode] = useState<Mode>(
    isCredit && initial.shares.length === 0 ? "repayment" : "share",
  );
  const [saving, setSaving] = useState(false);

  // --- Dépense partagée (montant < 0) : parts multi-personnes ---------------
  const [nature, setNature] = useState<SplitNature>(initial.nature ?? "debt");
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (initial.shares.length > 0)
      return new Set(initial.shares.map((s) => s.personId));
    return new Set(selfId ? [selfId] : []);
  });
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    if (initial.shares.length > 0)
      return Object.fromEntries(initial.shares.map((s) => [s.personId, String(s.amount)]));
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

  async function saveShares(shares: { personId: string; amount: number }[], natureVal: SplitNature) {
    setSaving(true);
    const res = await setTransactionShares(transactionId, { nature: natureVal, shares });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(shares.length ? "Enregistré" : "Partage retiré");
    router.refresh();
    onSaved?.();
  }
  const saveSplit = () =>
    saveShares(
      checkedIds.map((id) => ({ personId: id, amount: parsed.get(id) ?? 0 })),
      nature,
    );

  // --- Crédit « À rembourser » (montant > 0) : une seule personne -----------
  const [owePerson, setOwePerson] = useState<string>(() => {
    const first = initial.shares.find((s) => s.personId !== selfId);
    return first?.personId ?? (others.length === 1 ? others[0].id : "");
  });
  const [oweAmount, setOweAmount] = useState<string>(String(total));

  function saveOwe() {
    if (!owePerson) return toast.error("Choisis une personne.");
    const v = parseFloat(oweAmount.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return toast.error("Saisis un montant positif.");
    // Part « dette » sur un crédit → argent que je dois à la personne.
    return saveShares([{ personId: owePerson, amount: v }], "debt");
  }

  // --- Remboursement (crédits uniquement) ----------------------------------
  const [repayCtx, setRepayCtx] = useState<TransactionRepaymentContext | null>(null);
  const [repayPerson, setRepayPerson] = useState<string>("");
  const [repayAmount, setRepayAmount] = useState<string>(String(total));
  const [repayNote, setRepayNote] = useState<string>("");
  const [savingRepay, setSavingRepay] = useState(false);

  useEffect(() => {
    if (!isCredit) return;
    let alive = true;
    getTransactionRepayment(transactionId).then((ctx) => {
      if (!alive) return;
      setRepayCtx(ctx);
      if (ctx.repayment) {
        setRepayPerson(ctx.repayment.personId);
        setRepayAmount(String(ctx.repayment.amount));
        setRepayNote(ctx.repayment.note ?? "");
        setMode("repayment");
      } else if (others.length === 1) {
        setRepayPerson(others[0].id);
      }
    });
    return () => {
      alive = false;
    };
  }, [transactionId, isCredit, others]);

  async function saveRepayment() {
    if (!repayPerson) return toast.error("Choisis une personne.");
    const value = parseFloat(repayAmount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0)
      return toast.error("Saisis un montant positif.");
    setSavingRepay(true);
    const existing = repayCtx?.repayment ?? null;
    const payload = {
      personId: repayPerson,
      amount: value,
      repaidOn: repayCtx?.operationDate ?? null,
      transactionId,
      note: repayNote || null,
    };
    let res;
    if (existing && existing.personId === repayPerson) {
      res = await updateRepayment(existing.id, payload);
    } else {
      if (existing) {
        const del = await deleteRepayment(existing.id);
        if (!del.ok) {
          setSavingRepay(false);
          return toast.error(del.error);
        }
      }
      res = await addRepayment(payload);
    }
    setSavingRepay(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(existing ? "Remboursement mis à jour" : "Remboursement enregistré");
    router.refresh();
    onSaved?.();
  }

  async function removeRepayment() {
    const existing = repayCtx?.repayment;
    if (!existing) return;
    setSavingRepay(true);
    const res = await deleteRepayment(existing.id);
    setSavingRepay(false);
    if (!res.ok) return toast.error(res.error);
    setRepayCtx({ ...repayCtx!, repayment: null });
    toast.success("Remboursement retiré");
    router.refresh();
    onSaved?.();
  }

  // --- Rendu ----------------------------------------------------------------
  const segBtn = (
    label: string,
    Icon: typeof Gift,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: 32,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${active ? "var(--color-brand-primary)" : "var(--color-border)"}`,
        background: active ? "var(--color-brand-primary-50)" : "var(--color-bg-surface)",
        color: active ? "var(--color-brand-primary-700)" : "var(--color-text-secondary)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        cursor: "pointer",
      }}
    >
      <Icon size={15} aria-hidden />
      {label}
    </button>
  );

  const personBtn = (id: string, name: string, color: string, active: boolean, onClick: () => void) => (
    <button
      key={id}
      type="button"
      onClick={onClick}
      data-active={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: 36,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${active ? "var(--color-brand-primary)" : "var(--color-border)"}`,
        background: active ? "var(--color-brand-primary-50)" : "var(--color-bg-surface)",
        color: active ? "var(--color-brand-primary-700)" : "var(--color-text-secondary)",
        fontSize: "var(--text-sm)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <Dot color={color} />
      {name}
    </button>
  );

  if (persons.length === 0) {
    return (
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
        Aucune personne. Crée-en une dans « Personnes » pour partager cette transaction.
      </p>
    );
  }

  // Dépense : ventilation multi-personnes (dette / cadeau).
  const splitPanel = (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {persons.map((p) => {
          const isChecked = checked.has(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "space-between" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
                <Checkbox checked={isChecked} onChange={() => toggle(p.id)} />
                <Dot color={p.color} />
                {p.name}
                {p.isSelf && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>(moi)</span>
                )}
              </label>
              {isChecked && (
                <div style={{ width: 120 }}>
                  <Input
                    value={amounts[p.id] ?? ""}
                    inputMode="decimal"
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
        <Button type="button" variant="ghost" size="sm" leftIcon={<Scale size={15} />} onClick={() => redistribute(checkedIds)} disabled={checkedIds.length === 0}>
          Répartir équitablement
        </Button>
        <div style={{ flex: 1 }} />
        {segBtn("Dette", HandCoins, nature === "debt", () => setNature("debt"))}
        {segBtn("Cadeau", Gift, nature === "gift", () => setNature("gift"))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", padding: "var(--space-3)", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-text-muted)" }}>Ma part</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(myShare, currency)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-text-muted)" }}>
            {nature === "gift" ? "Cadeaux offerts" : "Créances (à te rembourser)"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(othersSum, currency)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: mismatch ? "var(--color-warning-dark)" : "var(--color-text-muted)" }}>
          <span>Total réparti / transaction</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {formatCurrency(sumShares, currency)} / {formatCurrency(total, currency)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
        {initial.shares.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" leftIcon={<RotateCcw size={15} />} onClick={() => { setChecked(new Set()); setAmounts({}); }}>
            Ne pas partager
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" size="sm" leftIcon={<Users size={15} />} loading={saving} onClick={saveSplit}>
          Enregistrer le partage
        </Button>
      </div>
    </>
  );

  // Crédit « À rembourser » : une seule personne, sans partage.
  const owePanel =
    others.length === 0 ? (
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
        Aucune autre personne. Crée-en une dans « Personnes ».
      </p>
    ) : (
      <>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
          À qui dois-tu rembourser cet argent reçu&nbsp;?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {others.map((p) => personBtn(p.id, p.name, p.color, owePerson === p.id, () => setOwePerson(p.id)))}
        </div>
        <div style={{ width: 140 }}>
          <Input
            value={oweAmount}
            inputMode="decimal"
            onChange={(e) => setOweAmount(e.target.value)}
            placeholder="Montant"
            style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}
          />
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
          Ce montant compte comme de l&apos;argent que tu dois à la personne (impacte
          son solde en négatif — ex. virement reçu à lui reverser).
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
          {initial.shares.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" leftIcon={<RotateCcw size={15} />} loading={saving} onClick={() => saveShares([], nature)}>
              Retirer
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" leftIcon={<HandCoins size={15} />} loading={saving} onClick={saveOwe}>
            Enregistrer
          </Button>
        </div>
      </>
    );

  const repaymentPanel =
    others.length === 0 ? (
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
        Aucune autre personne. Crée-en une dans « Personnes » pour enregistrer un remboursement.
      </p>
    ) : (
      <>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
          Qui te rembourse avec ce crédit&nbsp;?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {others.map((p) => personBtn(p.id, p.name, p.color, repayPerson === p.id, () => setRepayPerson(p.id)))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
          <div style={{ width: 120 }}>
            <Input value={repayAmount} inputMode="decimal" onChange={(e) => setRepayAmount(e.target.value)} placeholder="Montant" style={{ textAlign: "right", fontFamily: "var(--font-mono)" }} />
          </div>
          <Input value={repayNote} onChange={(e) => setRepayNote(e.target.value)} placeholder="Note (optionnel)" style={{ flex: "1 1 160px", minWidth: 0 }} />
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
          Ce crédit sera marqué comme remboursement&nbsp;: il éteint la dette de la
          personne et sort de tes revenus du mois.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
          {repayCtx?.repayment ? (
            <Button type="button" variant="ghost" size="sm" leftIcon={<RotateCcw size={15} />} loading={savingRepay} onClick={removeRepayment}>
              Retirer le remboursement
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" leftIcon={<ArrowDownLeft size={15} />} loading={savingRepay} onClick={saveRepayment}>
            {repayCtx?.repayment ? "Enregistrer" : "Marquer comme remboursement"}
          </Button>
        </div>
      </>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {isCredit && (
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          {segBtn("À rembourser", HandCoins, mode === "share", () => setMode("share"))}
          {segBtn("Remboursement", ArrowDownLeft, mode === "repayment", () => setMode("repayment"))}
        </div>
      )}
      {!isCredit ? splitPanel : mode === "repayment" ? repaymentPanel : owePanel}
    </div>
  );
}
