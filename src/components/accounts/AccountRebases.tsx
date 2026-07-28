"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Anchor } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input, DateInput, CurrencyInput } from "@/components/ui/Input";
import { Amount } from "@/components/ui/Amount";
import { formatShortDate } from "@/lib/format/date";
import { useToast } from "@/hooks/useToast";
import {
  addAccountRebase,
  deleteAccountRebase,
} from "@/server/actions/accounts";
import type { AccountRebase } from "@/lib/accounts/types";

/**
 * Gestion des rebasements d'un compte : ancre le solde réel à une date pour que
 * le solde courant colle à la réalité (les niveaux calculés depuis le solde
 * initial peuvent dériver). Plusieurs rebasements possibles ; le plus récent
 * fait foi (solde ancré + transactions validées postérieures).
 */
export function AccountRebases({
  accountId,
  rebases,
}: {
  accountId: string;
  rebases: AccountRebase[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState("");
  const [balance, setBalance] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const cleaned = balance.replace(/[\s€]/g, "").replace(",", ".");
    const n = Number(cleaned);
    if (!date) return toast.error("Choisis une date de rebasement.");
    if (!cleaned || !Number.isFinite(n)) return toast.error("Saisis le solde réel.");
    setBusy(true);
    const res = await addAccountRebase(accountId, { rebaseDate: date, balance: n, note });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setDate("");
    setBalance("");
    setNote("");
    toast.success("Compte rebasé");
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteAccountRebase(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Rebasement supprimé");
    router.refresh();
  }

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div>
          <h2 className="card-analytics__title" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Anchor size={16} aria-hidden /> Rebasement du solde
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "var(--space-1) 0 0" }}>
            Ancre le solde réel à une date : à cette date le compte vaut
            exactement la valeur saisie, puis les transactions validées
            postérieures (jusqu&apos;à aujourd&apos;hui) s&apos;y ajoutent. Le
            rebasement le plus récent fait foi.
          </p>
        </div>

        {rebases.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rebases.map((r, i) => (
              <div
                key={r.id}
                style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0", borderTop: i === 0 ? "none" : "1px solid var(--color-border)" }}
              >
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", minWidth: 90 }}>
                  {formatShortDate(r.rebase_date)}
                </span>
                <Amount value={Number(r.balance)} size="md" tone="neutral" />
                {i === 0 && <span className="badge-status-validated">actif</span>}
                {r.note && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.note}
                  </span>
                )}
                <IconButton label="Supprimer le rebasement" onClick={() => remove(r.id)} style={{ marginLeft: "auto" }}>
                  <X size={15} />
                </IconButton>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 160 }}>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de rebasement" />
          </div>
          <div style={{ width: 150 }}>
            <CurrencyInput
              placeholder="Solde réel"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
            />
          </div>
          <Input
            placeholder="Note (optionnel)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: "1 1 180px", minWidth: 0 }}
          />
          <Button leftIcon={<Plus size={16} />} loading={busy} onClick={add}>
            Rebaser
          </Button>
        </div>
      </div>
    </Card>
  );
}
