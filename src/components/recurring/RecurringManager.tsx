"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Pencil, Trash2, Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Amount } from "@/components/ui/Amount";
import { RecurringBadge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Checkbox";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { RecurringForm } from "./RecurringForm";
import { RecurringEditModal } from "./RecurringEditModal";
import { GroupedByCategory } from "@/components/categories/GroupedByCategory";
import { groupByCategory, preciseSubName } from "@/lib/categories/group";
import { formatShortDate } from "@/lib/format/date";
import { matchesQuery } from "@/lib/search/filter";
import { useImportStore } from "@/stores/import";
import {
  detectRecurring,
  createFromCandidate,
  applyRecurringPattern,
  deleteRecurringPattern,
  setRecurringActive,
  type DetectedRecurring,
} from "@/server/actions/recurring";
import type { RecurringPatternView } from "@/lib/recurring/queries";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";

type ModalState = { mode: "create" } | null;

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
  const [editId, setEditId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DetectedRecurring[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [query, setQuery] = useState("");

  const [localPatterns, setLocalPatterns] = useState(patterns);
  const [prevPatterns, setPrevPatterns] = useState(patterns);
  if (patterns !== prevPatterns) {
    setPrevPatterns(patterns);
    setLocalPatterns(patterns);
  }

  const preciseNames = useMemo(
    () => new Map(subcategoryOptions.map((o) => [o.id, preciseSubName(o)])),
    [subcategoryOptions],
  );

  // Recherche : nom, enseigne, catégorie, compte et motifs du libellé.
  const filteredPatterns = useMemo(
    () =>
      localPatterns.filter((p) =>
        matchesQuery(query, [
          p.name,
          p.merchantName,
          p.categoryLabel,
          p.subcategory_id ? preciseNames.get(p.subcategory_id) : null,
          p.accountName,
          p.label_pattern,
        ]),
      ),
    [localPatterns, query, preciseNames],
  );

  const groups = useMemo(
    () =>
      groupByCategory(
        filteredPatterns,
        (p) => p.subcategory_id,
        subcategoryOptions,
      ),
    [filteredPatterns, subcategoryOptions],
  );

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

  async function addCandidate(c: DetectedRecurring) {
    const res = await createFromCandidate(c);
    if (!res.ok) return toast.error(res.error);
    toast.success("Récurrente ajoutée");
    setCandidates((prev) => prev?.filter((x) => x !== c) ?? null);
    router.refresh();
  }

  async function assignCandidate(c: DetectedRecurring) {
    if (!c.existingPatternId) return;
    const res = await applyRecurringPattern(c.existingPatternId);
    if (!res.ok) return toast.error(res.error);
    toast.success(
      res.applied > 0
        ? `${res.applied} transaction${res.applied > 1 ? "s" : ""} rattachée${res.applied > 1 ? "s" : ""} à « ${c.name} »`
        : "Aucune transaction à rattacher",
    );
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

  function renderTable(items: RecurringPatternView[]) {
    return (
      <table className="table-transactions table-grouped">
        <colgroup>
          <col style={{ width: 64 }} />
          <col />
          <col style={{ width: 170 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 210 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 88 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Active</th>
            <th>Nom</th>
            <th>Catégorie</th>
            <th>Compte</th>
            <th>Montant</th>
            <th>Fréquence</th>
            <th>Suivi</th>
            <th>Statut</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.6 }}>
              <td>
                <Toggle
                  checked={p.is_active}
                  onChange={() => toggle(p)}
                  aria-label="Activer/désactiver"
                />
              </td>
              <td data-wrap="true">
                <div style={{ fontWeight: "var(--fw-medium)" }}>{p.name}</div>
                {p.merchantName && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {p.merchantName}
                  </div>
                )}
              </td>
              <td style={{ color: p.subcategory_id ? undefined : "var(--color-text-muted)" }}>
                {p.subcategory_id ? preciseNames.get(p.subcategory_id) ?? "—" : "—"}
              </td>
              <td>{p.accountName ?? "Tous"}</td>
              <td>
                {p.expected_amount != null ? (
                  <Amount value={Number(p.expected_amount)} />
                ) : (
                  <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
                    Variable
                  </span>
                )}
              </td>
              <td style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                {p.frequency_days} j
              </td>
              <td style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                {p.effectiveLastSeen ? `Vu ${formatShortDate(p.effectiveLastSeen)}` : "Jamais vu"}
                {p.nextExpected ? ` · ~${formatShortDate(p.nextExpected)}` : ""}
              </td>
              <td>{p.status === "missing" ? <RecurringBadge missing /> : <RecurringBadge />}</td>
              <td>
                <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
                  <IconButton label="Modifier" onClick={() => setEditId(p.id)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label="Supprimer" onClick={() => remove(p.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
        <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une récurrente, enseigne, motif…"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Button variant="secondary" leftIcon={<Sparkles size={16} />} loading={detecting} onClick={detect}>
            Détecter automatiquement
          </Button>
          <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
            Nouvelle récurrente
          </Button>
        </div>
      </div>

      {candidates && candidates.length > 0 && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2 className="card-analytics__title">Suggestions détectées</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {candidates.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "space-between", padding: "var(--space-2) 0", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "var(--fw-medium)" }}>{c.name}</span>
                    {c.existingPatternId && (
                      <span className="badge-status-validated">Règle détectée</span>
                    )}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {c.existingPatternId
                      ? `${c.occurrences} transaction${c.occurrences > 1 ? "s" : ""} à rattacher`
                      : `${c.occurrences} occurrences · ~${c.frequency_days} j · dernière ${formatShortDate(c.last_seen_at)}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <Amount value={c.expected_amount} />
                  {c.existingPatternId ? (
                    <Button variant="secondary" size="sm" onClick={() => assignCandidate(c)}>
                      Assigner ({c.occurrences})
                    </Button>
                  ) : (
                    <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => addCandidate(c)}>
                      Ajouter
                    </Button>
                  )}
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
      ) : filteredPatterns.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="Aucun résultat"
            description={`Aucune récurrente ne correspond à « ${query} ».`}
          />
        </Card>
      ) : (
        <GroupedByCategory groups={groups} renderTable={renderTable} />
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title="Nouvelle récurrente"
      >
        {modal && (
          <RecurringForm
            mode="create"
            accountOptions={accountOptions}
            subcategoryOptions={subcategoryOptions}
            merchantOptions={merchantOptions}
            onDone={() => setModal(null)}
          />
        )}
      </Modal>

      <RecurringEditModal
        recurringId={editId}
        onClose={() => setEditId(null)}
        subcategoryOptions={subcategoryOptions}
        merchantOptions={merchantOptions}
      />
    </>
  );
}
