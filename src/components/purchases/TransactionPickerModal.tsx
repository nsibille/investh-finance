"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Amount } from "@/components/ui/Amount";
import { Dot } from "@/components/ui/Badge";
import { formatShortDate } from "@/lib/format/date";
import { getAttachableTransactions } from "@/server/actions/purchases";
import type { AttachableTransaction } from "@/lib/purchases/types";

/**
 * `transaction-picker-modal` — variante de `modal-surface` pour choisir une
 * transaction non rattachée (recherche + liste type `purchase-line-row`). Sert
 * à rattacher / assigner / réassigner une transaction depuis le détail d'un
 * achat. Charge les candidats via `getAttachableTransactions` (recherche
 * débouncée).
 */
export function TransactionPickerModal({
  open,
  onClose,
  title,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onPick: (transactionId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AttachableTransaction[]>([]);
  // Vrai tant que le premier chargement n'a pas répondu (défaut au montage :
  // le parent remonte ce composant à chaque ouverture via `key`).
  const [loading, setLoading] = useState(true);

  // Charge (débouncé) les transactions non rattachées, filtrées par libellé.
  useEffect(() => {
    if (!open) return;
    let active = true;
    const handle = setTimeout(async () => {
      const res = await getAttachableTransactions(query);
      if (!active) return;
      setItems(res);
      setLoading(false);
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [open, query]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une transaction…"
        />
        <div style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {items.map((t) => (
            <button
              key={t.id}
              type="button"
              className="purchase-line-row"
              style={{ background: "transparent", border: "none", cursor: "pointer", textAlign: "left", font: "inherit", width: "100%" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => {
                onPick(t.id);
                onClose();
              }}
            >
              {t.accountColor ? <Dot color={t.accountColor} /> : null}
              <span className="purchase-line-row__main">
                <span className="purchase-line-row__label">{t.label}</span>
                <span className="purchase-line-row__sub">
                  {formatShortDate(t.operation_date)}
                  {t.accountName ? ` · ${t.accountName}` : ""}
                </span>
              </span>
              <Amount value={t.amount} currency={t.currency} size="sm" />
            </button>
          ))}
          {items.length === 0 && (
            <div style={{ padding: "var(--space-3)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
              {loading ? "Chargement…" : "Aucune transaction non rattachée."}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
