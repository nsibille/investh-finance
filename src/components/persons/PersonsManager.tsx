"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  ChevronRight,
  ChevronDown,
  Gift,
  HandCoins,
  X,
  ArrowUpRight,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Dot } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { PersonForm } from "./PersonForm";
import { formatCurrency } from "@/lib/format/currency";
import { formatShortDate } from "@/lib/format/date";
import {
  deletePerson,
  addRepayment,
  deleteRepayment,
} from "@/server/actions/persons";
import type { PersonLedger } from "@/lib/persons/types";
import type { CreditCandidate } from "@/lib/persons/queries";

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; person: PersonLedger }
  | null;

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

function RepaymentForm({
  personId,
  outstanding,
  candidates,
}: {
  personId: string;
  outstanding: number;
  candidates: CreditCandidate[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(
    outstanding > 0 ? String(Math.round(outstanding * 100) / 100) : "",
  );
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [txId, setTxId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0)
      return toast.error("Saisis un montant positif.");
    setBusy(true);
    const res = await addRepayment({
      personId,
      amount: value,
      repaidOn: date || null,
      transactionId: txId || null,
      note: note || null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Remboursement enregistré");
    setAmount("");
    setDate("");
    setNote("");
    setTxId("");
    router.refresh();
  }

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
        <Button size="sm" loading={busy} onClick={submit}>
          Enregistrer le remboursement
        </Button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {candidates.length > 0 && (
          <Select
            value={txId}
            onChange={(e) => {
              const id = e.target.value;
              setTxId(id);
              const c = candidates.find((x) => x.id === id);
              if (c) setAmount(String(c.amount));
            }}
            style={{ maxWidth: 280 }}
          >
            <option value="">Lier une transaction créditée (optionnel)…</option>
            {candidates.map((c) => (
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
    </div>
  );
}

function PersonCard({
  person,
  candidates,
  onEdit,
  onDelete,
}: {
  person: PersonLedger;
  candidates: CreditCandidate[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  async function removeRepayment(id: string) {
    const res = await deleteRepayment(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Remboursement supprimé");
    router.refresh();
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Dot color={person.color} />
          <Link
            href={`/personnes/${person.id}`}
            style={{ fontWeight: "var(--fw-semibold)", color: "var(--color-text-primary)" }}
          >
            {person.name}
          </Link>
        </div>
        <div style={{ display: "flex", gap: "var(--space-1)" }}>
          <Link href={`/personnes/${person.id}`}>
            <IconButton label="Ouvrir la fiche">
              <ArrowUpRight size={16} />
            </IconButton>
          </Link>
          <IconButton label="Modifier" onClick={onEdit}>
            <Pencil size={16} />
          </IconButton>
          <IconButton label="Supprimer" onClick={onDelete}>
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "var(--space-4)",
          marginTop: "var(--space-4)",
        }}
      >
        <Stat label="Dettes" value={formatCurrency(person.totalDebt)} />
        <Stat label="Cadeaux" value={formatCurrency(person.totalGift)} color="var(--color-finance-investissement)" />
        <Stat label="Remboursé" value={formatCurrency(person.totalRepaid)} color="var(--color-success)" />
        <Stat
          label="Restant dû"
          value={formatCurrency(person.outstandingDebt)}
          color={person.outstandingDebt > 0.01 ? "var(--color-danger)" : "var(--color-text-muted)"}
        />
      </div>

      <div style={{ marginTop: "var(--space-4)" }}>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Masquer le détail" : "Voir le détail"}
        </Button>
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", marginTop: "var(--space-4)" }}>
          {/* Parts dette / cadeau */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
              Transactions partagées
            </span>
            {person.shares.length === 0 ? (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
                Aucune part rattachée.
              </p>
            ) : (
              person.shares.map((s) => (
                <div
                  key={s.transactionId}
                  style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}
                >
                  {s.nature === "gift" ? (
                    <Gift size={14} aria-hidden style={{ color: "var(--color-finance-investissement)", flexShrink: 0 }} />
                  ) : (
                    <HandCoins size={14} aria-hidden style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                  )}
                  <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
                    {formatShortDate(s.operationDate)}
                  </span>
                  <Link
                    href={`/transactions/${s.transactionId}`}
                    style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-link)" }}
                  >
                    {s.label}
                  </Link>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(s.shareAmount)}</span>
                </div>
              ))
            )}
          </div>

          {/* Remboursements */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
              Remboursements
            </span>
            {person.repayments.map((r) => (
              <div
                key={r.id}
                style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}
              >
                <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
                  {formatShortDate(r.repaidOn)}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.transactionLabel ?? r.note ?? "Remboursement"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-success)" }}>
                  {formatCurrency(r.amount)}
                </span>
                <IconButton label="Supprimer le remboursement" onClick={() => removeRepayment(r.id)}>
                  <X size={14} />
                </IconButton>
              </div>
            ))}
            <RepaymentForm
              personId={person.id}
              outstanding={person.outstandingDebt}
              candidates={candidates}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

export function PersonsManager({
  persons,
  creditCandidates,
}: {
  persons: PersonLedger[];
  creditCandidates: CreditCandidate[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<PersonLedger | null>(null);

  const others = useMemo(() => persons.filter((p) => !p.isSelf), [persons]);

  async function handleDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    const res = await deletePerson(target.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Personne supprimée");
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "var(--space-5)" }}>
        <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
          Nouvelle personne
        </Button>
      </div>

      {others.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Aucune personne"
            description="Crée une personne pour partager des transactions (dettes, cadeaux) et suivre les remboursements."
            action={
              <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
                Nouvelle personne
              </Button>
            }
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {others.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              candidates={creditCandidates}
              onEdit={() => setModal({ mode: "edit", person: p })}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier la personne" : "Nouvelle personne"}
      >
        {modal && (
          <PersonForm
            mode={modal.mode}
            id={modal.mode === "edit" ? modal.person.id : undefined}
            initial={
              modal.mode === "edit"
                ? { name: modal.person.name, color: modal.person.color }
                : undefined
            }
            onDone={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer la personne ?"
        variantClass="modal-confirm-danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Supprimer
            </Button>
          </>
        }
      >
        <Alert variant="warning">
          Les parts et remboursements de cette personne seront supprimés. Les
          transactions concernées perdront cette part de ventilation.
        </Alert>
      </Modal>
    </>
  );
}
