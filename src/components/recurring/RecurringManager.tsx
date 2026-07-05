"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Pencil, Trash2, Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Amount } from "@/components/ui/Amount";
import { RecurringBadge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Checkbox";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { RecurringForm } from "./RecurringForm";
import { formatShortDate } from "@/lib/format/date";
import { useImportStore } from "@/stores/import";
import {
  detectRecurring,
  createFromCandidate,
  deleteRecurringPattern,
  setRecurringActive,
} from "@/server/actions/recurring";
import type { RecurringPatternView } from "@/lib/recurring/queries";
import type { RecurringCandidate } from "@/lib/recurring/detector";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; pattern: RecurringPatternView }
  | null;

export function RecurringManager({
  patterns,
  accountOptions,
  subcategoryOptions,
  merchantOptions,
}: {
  patterns: RecurringPatternView[];
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [candidates, setCandidates] = useState<RecurringCandidate[] | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [localPatterns, setLocalPatterns] = useState(patterns);
  const [prevPatterns, setPrevPatterns] = useState(patterns);
  if (patterns !== prevPatterns) {
    setPrevPatterns(patterns);
    setLocalPatterns(patterns);
  }

  async function detect() {
    setDetecting(true);
    // Inclut l'aperçu d'import en cours (persisté en mémoire) pour créer les
    // récurrences à la volée sans avoir à valider l'import d'abord.
    const preview = useImportStore.getState().preview;
    const importRows = preview?.rows.map((r) => ({
      raw_label: r.raw_label,
      amount: r.amount,
      operation_date: r.operation_date,
    }));
    const found = await detectRecurring(importRows);
    setDetecting(false);
    setCandidates(found);
    if (found.length === 0) toast.info("Aucune nouvelle récurrente détectée.");
    else if (importRows?.length) {
      toast.info("Détection incluant l'import en cours.");
    }
  }

  async function addCandidate(c: RecurringCandidate) {
    const res = await createFromCandidate(c);
    if (!res.ok) return toast.error(res.error);
    toast.success("Récurrente ajoutée");
    setCandidates((prev) => prev?.filter((x) => x !== c) ?? null);
    router.refresh();
  }

  async function toggle(p: RecurringPatternView) {
    const snapshot = localPatterns;
    const res = await runOptimistic({
      apply: () =>
        setLocalPatterns(
          snapshot.map((x) =>
            x.id === p.id ? { ...x, is_active: !p.is_active } : x,
          ),
        ),
      rollback: () => setLocalPatterns(snapshot),
      run: () => setRecurringActive(p.id, !p.is_active),
      onError: toast.error,
    });
    if (res.ok) router.refresh();
  }

  async function remove(id: string) {
    const snapshot = localPatterns;
    const res = await runOptimistic({
      apply: () => setLocalPatterns(snapshot.filter((x) => x.id !== id)),
      rollback: () => setLocalPatterns(snapshot),
      run: () => deleteRecurringPattern(id),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success("Supprimée");
      router.refresh();
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <Button variant="secondary" leftIcon={<Sparkles size={16} />} loading={detecting} onClick={detect}>
          Détecter automatiquement
        </Button>
        <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
          Nouvelle récurrente
        </Button>
      </div>

      {candidates && candidates.length > 0 && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2 className="card-analytics__title">Suggestions détectées</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {candidates.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "space-between", padding: "var(--space-2) 0", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: "var(--fw-medium)" }}>{c.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {c.occurrences} occurrences · ~{c.frequency_days} j · dernière {formatShortDate(c.last_seen_at)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <Amount value={c.expected_amount} />
                  <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => addCandidate(c)}>Ajouter</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {localPatterns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="Aucune récurrente"
            description="Détecte automatiquement tes abonnements et revenus réguliers, ou ajoute-les manuellement."
          />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
          {localPatterns.map((p) => (
            <div className="card-recurring" key={p.id} style={{ opacity: p.is_active ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: "var(--fw-semibold)" }}>{p.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                    {[p.accountName, p.categoryLabel, p.merchantName].filter(Boolean).join(" · ") || "Tous comptes"}
                  </div>
                </div>
                {p.status === "missing" ? <RecurringBadge missing /> : <RecurringBadge />}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {p.expected_amount != null ? (
                  <Amount value={Number(p.expected_amount)} size="lg" />
                ) : (
                  <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Montant variable</span>
                )}
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  tous les {p.frequency_days} j
                </span>
              </div>

              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {p.effectiveLastSeen ? `Vu le ${formatShortDate(p.effectiveLastSeen)}` : "Jamais vu"}
                {p.nextExpected ? ` · prévu ~${formatShortDate(p.nextExpected)}` : ""}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)" }}>
                  <Toggle checked={p.is_active} onChange={() => toggle(p)} /> Active
                </label>
                <div style={{ display: "flex", gap: "var(--space-1)" }}>
                  <IconButton label="Modifier" onClick={() => setModal({ mode: "edit", pattern: p })}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label="Supprimer" onClick={() => remove(p.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier la récurrente" : "Nouvelle récurrente"}
      >
        {modal && (
          <RecurringForm
            mode={modal.mode}
            id={modal.mode === "edit" ? modal.pattern.id : undefined}
            accountOptions={accountOptions}
            subcategoryOptions={subcategoryOptions}
            merchantOptions={merchantOptions}
            initial={
              modal.mode === "edit"
                ? {
                    name: modal.pattern.name,
                    account_id: modal.pattern.account_id ?? "",
                    merchant_id: modal.pattern.merchant_id ?? "",
                    subcategory_id: modal.pattern.subcategory_id ?? "",
                    expected_amount: modal.pattern.expected_amount ?? "",
                    amount_tolerance: modal.pattern.amount_tolerance,
                    frequency_days: modal.pattern.frequency_days,
                    label_pattern: modal.pattern.label_pattern ?? "",
                    alert_if_missing: modal.pattern.alert_if_missing,
                  }
                : undefined
            }
            onDone={() => setModal(null)}
          />
        )}
      </Modal>
    </>
  );
}
