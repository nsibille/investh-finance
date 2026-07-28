"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Amount } from "@/components/ui/Amount";
import { useToast } from "@/hooks/useToast";
import { formatMonthLabel } from "@/lib/format/date";
import { installmentOccurrence } from "@/lib/purchases/installments";
import { addInstallment, deleteInstallment } from "@/server/actions/purchases";
import type { PurchaseWithDetails } from "@/lib/purchases/types";

function parseAmount(s: string): number {
  return parseFloat(s.replace(/[\s€]/g, "").replace(",", "."));
}

/** Éditeur d'échéancier : suppression ligne à ligne (échéances non appariées)
 *  + ajout d'une mensualité. Réutilisé par la modale d'édition (page Achats)
 *  et la page de détail d'un achat. */
export function InstallmentEditor({
  purchase,
  onChanged,
}: {
  purchase: PurchaseWithDetails;
  /**
   * Rafraîchissement après ajout/suppression d'échéance. Fourni ⇒ appelé à la
   * place de `router.refresh()` (permet de recharger le contenu d'une modale
   * sans la fermer). Absent ⇒ `router.refresh()` (page Achats).
   */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [month, setMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => (onChanged ? onChanged() : router.refresh());

  const startMonth = purchase.installments[0]?.month;
  const total = purchase.installments.length;
  const endless = purchase.is_recurring && !purchase.recurrence_end;

  async function add() {
    if (!month) return toast.error("Choisis un mois.");
    const value = parseAmount(amount);
    if (!Number.isFinite(value)) return toast.error("Montant invalide.");
    setBusy(true);
    const res = await addInstallment(purchase.id, `${month}-01`, value);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setMonth("");
    setAmount("");
    refresh();
  }

  async function remove(id: string) {
    const res = await deleteInstallment(id);
    if (!res.ok) return toast.error(res.error);
    refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {purchase.installments.map((inst) => {
          const occurrence = installmentOccurrence(startMonth ?? inst.month, inst.month);
          return (
            <div
              key={inst.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                fontSize: "var(--text-sm)",
                opacity: inst.transaction_id ? 1 : 0.7,
              }}
            >
              <span style={{ flex: 1, textTransform: "capitalize" }}>
                {formatMonthLabel(inst.month)}
                {(total > 1 || endless) && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-muted)",
                      textTransform: "none",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {occurrence}/{endless ? "∞" : total}
                  </span>
                )}
              </span>
              <Amount value={Number(inst.amount)} size="sm" tone="neutral" />
              {inst.transaction_id ? (
                <span
                  title="Appariée à une transaction"
                  style={{ color: "var(--color-success)", display: "inline-flex" }}
                >
                  <Check size={15} aria-hidden />
                </span>
              ) : (
                <IconButton label="Supprimer" onClick={() => remove(inst.id)}>
                  <X size={14} />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input-text-md"
          style={{ maxWidth: 160 }}
        />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Montant"
          style={{ maxWidth: 120 }}
        />
        <Button variant="secondary" size="sm" loading={busy} onClick={add}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
