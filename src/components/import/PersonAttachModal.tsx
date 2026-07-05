"use client";

import { useState } from "react";
import { Gift, HandCoins } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dot } from "@/components/ui/Badge";
import type { PersonOption, SplitNature } from "@/lib/persons/types";

/**
 * Modale d'attache de personnes à une ligne d'import : sélection multiple
 * (moi coché par défaut) + nature globale dette/cadeau. Le montant est réparti
 * à parts égales à l'import (ajustable ensuite à l'édition).
 */
export function PersonAttachModal({
  open,
  onClose,
  persons,
  initial,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  persons: PersonOption[];
  initial: { nature: SplitNature; personIds: string[] } | null;
  onAttach: (value: { nature: SplitNature; personIds: string[] } | null) => void;
}) {
  const selfId = persons.find((p) => p.isSelf)?.id ?? null;
  // L'état initial vient des props : le parent remonte la modale par `key`
  // à chaque changement de ligne, donc pas besoin d'effet de synchronisation.
  const [nature, setNature] = useState<SplitNature>(initial?.nature ?? "debt");
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initial?.personIds ?? (selfId ? [selfId] : [])),
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const ids = persons.filter((p) => checked.has(p.id)).map((p) => p.id);
    onAttach(ids.length > 0 ? { nature, personIds: ids } : null);
    onClose();
  }

  const natureBtn = (value: SplitNature, label: string, Icon: typeof Gift) => (
    <button
      type="button"
      onClick={() => setNature(value)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: 32,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${nature === value ? "var(--color-brand-primary)" : "var(--color-border)"}`,
        background:
          nature === value ? "var(--color-brand-primary-50)" : "var(--color-bg-surface)",
        color:
          nature === value
            ? "var(--color-brand-primary-700)"
            : "var(--color-text-secondary)",
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
    <Modal open={open} onClose={onClose} title="Partager avec des personnes">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {persons.length === 0 ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
            Aucune personne. Crée-en une dans « Personnes » d&apos;abord.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {persons.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    fontSize: "var(--text-sm)",
                    cursor: "pointer",
                  }}
                >
                  <Checkbox checked={checked.has(p.id)} onChange={() => toggle(p.id)} />
                  <Dot color={p.color} />
                  {p.name}
                  {p.isSelf && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                      (moi)
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              {natureBtn("debt", "Dette", HandCoins)}
              {natureBtn("gift", "Cadeau", Gift)}
            </div>

            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              Le montant sera réparti à parts égales entre les personnes cochées
              (ajustable ensuite sur la transaction).
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <Button variant="secondary" onClick={confirm}>
                {checked.size === 0 ? "Ne pas partager" : "Valider le partage"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
