"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Plus,
  Gift,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dot } from "@/components/ui/Badge";
import { PersonForm } from "./PersonForm";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/format/currency";
import { formatShortDate } from "@/lib/format/date";
import {
  addManualEntry,
  updateManualEntry,
  deleteManualEntry,
  addRepayment,
  updateRepayment,
  deleteRepayment,
} from "@/server/actions/persons";
import type {
  PersonLedger,
  PersonEvent,
  PersonManualEntryRow,
  PersonRepaymentRow,
  SplitNature,
} from "@/lib/persons/types";
import type { CreditCandidate } from "@/lib/persons/queries";

/** Libellé du solde net signé (> 0 : la personne me doit ; < 0 : je lui dois). */
function soldeLabel(net: number): string {
  if (Math.abs(net) <= 0.01) return "Solde";
  return net < 0 ? "Solde · tu dois" : "Solde · on te doit";
}

function soldeColor(net: number): string {
  if (Math.abs(net) <= 0.01) return "var(--color-text-muted)";
  return net < 0 ? "var(--color-danger)" : "var(--color-warning-dark)";
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-lg)",
          fontWeight: "var(--fw-semibold)",
          color: color ?? "var(--color-text-primary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function NatureToggle({
  value,
  onChange,
}: {
  value: SplitNature;
  onChange: (v: SplitNature) => void;
}) {
  const btn = (v: SplitNature, label: string, Icon: typeof Gift) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: 32,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${value === v ? "var(--color-brand-primary)" : "var(--color-border)"}`,
        background:
          value === v ? "var(--color-brand-primary-50)" : "var(--color-bg-surface)",
        color:
          value === v ? "var(--color-brand-primary-700)" : "var(--color-text-secondary)",
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
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      {btn("debt", "Dette", HandCoins)}
      {btn("gift", "Cadeau", Gift)}
    </div>
  );
}

/** Formulaire de dette / cadeau manuel (création ou édition). */
function ManualEntryForm({
  personId,
  initial,
  onDone,
}: {
  personId: string;
  initial?: PersonManualEntryRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [nature, setNature] = useState<SplitNature>(initial?.nature ?? "debt");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.entryDate ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0)
      return toast.error("Saisis un montant positif.");
    setBusy(true);
    const payload = {
      nature,
      amount: value,
      entryDate: date || null,
      label: label || null,
      note: note || null,
    };
    const res = initial
      ? await updateManualEntry(initial.id, payload)
      : await addManualEntry({ personId, ...payload });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(initial ? "Entrée mise à jour" : "Entrée enregistrée");
    router.refresh();
    onDone();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <NatureToggle value={nature} onChange={setNature} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
        <Input
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Montant"
          style={{ maxWidth: 120, fontFamily: "var(--font-mono)" }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-text-md"
          style={{ maxWidth: 160 }}
        />
      </div>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Libellé (ex. prêt espèces, cadeau anniversaire)"
      />
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel)"
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
        <Button variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button loading={busy} onClick={submit}>
          {initial ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>
    </div>
  );
}

/** Formulaire de remboursement (création ou édition). */
function RepaymentForm({
  personId,
  outstanding,
  candidates,
  initial,
  onDone,
}: {
  personId: string;
  outstanding: number;
  candidates: CreditCandidate[];
  initial?: PersonRepaymentRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(
    initial
      ? String(initial.amount)
      : outstanding > 0
        ? String(Math.round(outstanding * 100) / 100)
        : "",
  );
  const [date, setDate] = useState(initial?.repaidOn ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [txId, setTxId] = useState(initial?.transactionId ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0)
      return toast.error("Saisis un montant positif.");
    setBusy(true);
    const payload = {
      personId,
      amount: value,
      repaidOn: date || null,
      transactionId: txId || null,
      note: note || null,
    };
    const res = initial
      ? await updateRepayment(initial.id, payload)
      : await addRepayment(payload);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(initial ? "Remboursement mis à jour" : "Remboursement enregistré");
    if (!initial) {
      setAmount("");
      setDate("");
      setNote("");
      setTxId("");
    }
    router.refresh();
    onDone();
  }

  // Une transaction déjà liée à ce remboursement n'apparaît pas dans les
  // candidats (déjà « utilisée ») : on l'ajoute pour la garder sélectionnable.
  const options =
    initial?.transactionId &&
    !candidates.some((c) => c.id === initial.transactionId)
      ? [
          {
            id: initial.transactionId,
            label: initial.transactionLabel ?? "Transaction liée",
            operationDate: initial.repaidOn,
            amount: initial.amount,
          },
          ...candidates,
        ]
      : candidates;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
        <Input
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Montant"
          style={{ maxWidth: 120, fontFamily: "var(--font-mono)" }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-text-md"
          style={{ maxWidth: 160 }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {options.length > 0 && (
          <Select
            value={txId}
            onChange={(e) => {
              const id = e.target.value;
              setTxId(id);
              const c = options.find((x) => x.id === id);
              if (c && !initial) setAmount(String(c.amount));
            }}
            style={{ maxWidth: 280 }}
          >
            <option value="">Lier une transaction créditée (optionnel)…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {formatShortDate(c.operationDate)} · {formatCurrency(c.amount)} · {c.label}
              </option>
            ))}
          </Select>
        )}
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optionnel)"
          style={{ flex: "1 1 200px", minWidth: 0 }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
        {initial && (
          <Button variant="secondary" onClick={onDone}>
            Annuler
          </Button>
        )}
        <Button size="sm" loading={busy} onClick={submit}>
          {initial ? "Enregistrer" : "Enregistrer le remboursement"}
        </Button>
      </div>
    </div>
  );
}

type EditState =
  | { kind: "person" }
  | { kind: "manual"; entry?: PersonManualEntryRow }
  | { kind: "repayment"; entry: PersonRepaymentRow }
  | null;

/**
 * `person-detail-page` — fiche complète d'une personne : soldes, timeline
 * unifiée des événements (transactions ventilées, dettes/cadeaux manuels,
 * remboursements) et édition inline de chaque type d'événement.
 */
export function PersonDetailView({
  person,
  events,
  candidates,
}: {
  person: PersonLedger;
  events: PersonEvent[];
  candidates: CreditCandidate[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<EditState>(null);
  const [confirmManual, setConfirmManual] = useState<string | null>(null);

  async function removeManual(id: string) {
    setConfirmManual(null);
    const res = await deleteManualEntry(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Entrée supprimée");
    router.refresh();
  }

  async function removeRepayment(id: string) {
    const res = await deleteRepayment(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Remboursement supprimé");
    router.refresh();
  }

  function EventRow({ e }: { e: PersonEvent }) {
    const isRepayment = e.kind === "repayment";
    const isGift = !isRepayment && e.nature === "gift";
    // Part « dette » sur une transaction reçue → argent que je dois (virement pro).
    const isIOwe = e.kind === "share" && e.nature === "debt" && e.direction === "i_owe";
    const Icon = isRepayment
      ? ArrowDownLeft
      : isGift
        ? Gift
        : isIOwe
          ? ArrowUpRight
          : HandCoins;
    const iconColor = isRepayment
      ? "var(--color-success)"
      : isGift
        ? "var(--color-finance-investissement)"
        : isIOwe
          ? "var(--color-danger)"
          : "var(--color-text-muted)";
    const amountColor = isRepayment
      ? "var(--color-success)"
      : isIOwe
        ? "var(--color-danger)"
        : "var(--color-text-primary)";

    const title =
      e.kind === "share"
        ? e.label
        : e.kind === "manual"
          ? (e.label ?? (e.nature === "gift" ? "Cadeau manuel" : "Dette manuelle"))
          : (e.label ?? e.note ?? "Remboursement");

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontSize: "var(--text-sm)",
          padding: "var(--space-2) 0",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Icon size={15} aria-hidden style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ color: "var(--color-text-muted)", flexShrink: 0, width: 76 }}>
          {formatShortDate(e.date)}
        </span>
        {e.kind === "share" || (e.kind === "repayment" && e.transactionId) ? (
          <Link
            href={`/transactions/${e.transactionId}`}
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--color-text-link)",
            }}
          >
            {title}
          </Link>
        ) : (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
        )}
        <span
          className="badge-tag-md"
          style={{ flexShrink: 0, color: "var(--color-text-muted)" }}
          title={
            e.kind === "share"
              ? "Transaction ventilée"
              : e.kind === "manual"
                ? "Entrée manuelle"
                : "Remboursement"
          }
        >
          {e.kind === "share"
            ? "Transaction"
            : e.kind === "manual"
              ? "Manuel"
              : "Remb."}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", flexShrink: 0, color: amountColor }}>
          {isRepayment ? "+" : isIOwe ? "−" : ""}
          {formatCurrency(e.amount)}
        </span>
        <div style={{ display: "flex", gap: 2, flexShrink: 0, width: 56, justifyContent: "flex-end" }}>
          {e.kind === "manual" && (
            <>
              <IconButton
                label="Modifier l'entrée"
                onClick={() =>
                  setEdit({
                    kind: "manual",
                    entry: person.manualEntries.find((m) => m.id === e.id),
                  })
                }
              >
                <Pencil size={14} />
              </IconButton>
              <IconButton label="Supprimer l'entrée" onClick={() => setConfirmManual(e.id)}>
                <X size={14} />
              </IconButton>
            </>
          )}
          {e.kind === "repayment" && (
            <>
              <IconButton
                label="Modifier le remboursement"
                onClick={() => {
                  const entry = person.repayments.find((r) => r.id === e.id);
                  if (entry) setEdit({ kind: "repayment", entry });
                }}
              >
                <Pencil size={14} />
              </IconButton>
              <IconButton
                label="Supprimer le remboursement"
                onClick={() => removeRepayment(e.id)}
              >
                <X size={14} />
              </IconButton>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Dot color={person.color} />
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--fw-semibold)", margin: 0, letterSpacing: "var(--tracking-tight)" }}>
              {person.name}
            </h1>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Pencil size={15} />} onClick={() => setEdit({ kind: "person" })}>
            Modifier
          </Button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "var(--space-4)",
            marginTop: "var(--space-5)",
          }}
        >
          <Stat label="On te doit" value={formatCurrency(person.totalDebt)} />
          {person.iOwe > 0.01 && (
            <Stat label="Tu dois" value={formatCurrency(person.iOwe)} color="var(--color-danger)" />
          )}
          <Stat label="Cadeaux" value={formatCurrency(person.totalGift)} color="var(--color-finance-investissement)" />
          <Stat label="Remboursé" value={formatCurrency(person.totalRepaid)} color="var(--color-success)" />
          <Stat
            label={soldeLabel(person.netBalance)}
            value={formatCurrency(Math.abs(person.netBalance))}
            color={soldeColor(person.netBalance)}
          />
        </div>
      </Card>

      <Card style={{ marginTop: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <span style={{ fontWeight: "var(--fw-semibold)" }}>Événements</span>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant="secondary" size="sm" leftIcon={<Plus size={15} />} onClick={() => setEdit({ kind: "manual" })}>
              Dette / cadeau manuel
            </Button>
          </div>
        </div>

        {events.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Aucun événement"
            description="Partage une transaction avec cette personne, ou ajoute une dette / un cadeau manuel."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {events.map((e) => (
              <EventRow key={`${e.kind}-${e.id}`} e={e} />
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginTop: "var(--space-4)" }}>
        <span style={{ fontWeight: "var(--fw-semibold)", display: "block", marginBottom: "var(--space-3)" }}>
          Enregistrer un remboursement
        </span>
        <RepaymentForm
          personId={person.id}
          outstanding={person.outstandingDebt}
          candidates={candidates}
          onDone={() => {}}
        />
      </Card>

      {/* Modales d'édition */}
      <Modal
        open={edit?.kind === "person"}
        onClose={() => setEdit(null)}
        title="Modifier la personne"
      >
        {edit?.kind === "person" && (
          <PersonForm
            mode="edit"
            id={person.id}
            initial={{ name: person.name, color: person.color }}
            onDone={() => setEdit(null)}
          />
        )}
      </Modal>

      <Modal
        open={edit?.kind === "manual"}
        onClose={() => setEdit(null)}
        title={edit?.kind === "manual" && edit.entry ? "Modifier l'entrée" : "Nouvelle dette / cadeau"}
      >
        {edit?.kind === "manual" && (
          <ManualEntryForm
            personId={person.id}
            initial={edit.entry}
            onDone={() => setEdit(null)}
          />
        )}
      </Modal>

      <Modal
        open={edit?.kind === "repayment"}
        onClose={() => setEdit(null)}
        title="Modifier le remboursement"
      >
        {edit?.kind === "repayment" && (
          <RepaymentForm
            personId={person.id}
            outstanding={person.outstandingDebt}
            candidates={candidates}
            initial={edit.entry}
            onDone={() => setEdit(null)}
          />
        )}
      </Modal>

      <Modal
        open={confirmManual !== null}
        onClose={() => setConfirmManual(null)}
        title="Supprimer cette entrée ?"
        variantClass="modal-confirm-danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmManual(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={() => confirmManual && removeManual(confirmManual)}>
              Supprimer
            </Button>
          </>
        }
      >
        <Alert variant="warning">
          Cette dette / ce cadeau manuel sera supprimé du registre de la personne.
        </Alert>
      </Modal>
    </>
  );
}
