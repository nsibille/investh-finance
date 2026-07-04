"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toggle } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { runOptimistic } from "@/lib/optimistic";
import { RuleForm } from "./RuleForm";
import { RuleImport } from "./RuleImport";
import { setRuleActive, deleteRule } from "@/server/actions/rules";
import type { Rule, AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";

const MATCH_LABELS: Record<Rule["match_type"], string> = {
  regex: "Regex",
  contains: "Contient",
  exact: "Exact",
};

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; rule: Rule }
  | null;

export function RulesManager({
  rules,
  subcategoryOptions,
  accountOptions,
  merchantOptions,
}: {
  rules: Rule[];
  subcategoryOptions: SubcategoryOption[];
  accountOptions: AccountOption[];
  merchantOptions: MerchantOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [toDelete, setToDelete] = useState<Rule | null>(null);

  const [localRules, setLocalRules] = useState(rules);
  const [prevRules, setPrevRules] = useState(rules);
  if (rules !== prevRules) {
    setPrevRules(rules);
    setLocalRules(rules);
  }

  const subLabels = useMemo(
    () => new Map(subcategoryOptions.map((o) => [o.id, o.label])),
    [subcategoryOptions],
  );
  const accountNames = useMemo(
    () => new Map(accountOptions.map((a) => [a.id, a.name])),
    [accountOptions],
  );

  async function toggleActive(rule: Rule) {
    const snapshot = localRules;
    const res = await runOptimistic({
      apply: () =>
        setLocalRules(
          snapshot.map((r) =>
            r.id === rule.id ? { ...r, is_active: !rule.is_active } : r,
          ),
        ),
      rollback: () => setLocalRules(snapshot),
      run: () => setRuleActive(rule.id, !rule.is_active),
      onError: toast.error,
    });
    if (res.ok) router.refresh();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const target = toDelete;
    const snapshot = localRules;
    setToDelete(null);
    const res = await runOptimistic({
      apply: () => setLocalRules(snapshot.filter((r) => r.id !== target.id)),
      rollback: () => setLocalRules(snapshot),
      run: () => deleteRule(target.id),
      onError: toast.error,
    });
    if (res.ok) {
      toast.success("Règle supprimée");
      router.refresh();
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-3)",
          marginBottom: "var(--space-5)",
        }}
      >
        <RuleImport subcategoryOptions={subcategoryOptions} />
        <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
          Nouvelle règle
        </Button>
      </div>

      {localRules.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wand2}
            title="Aucune règle"
            description="Crée des règles pour catégoriser automatiquement tes transactions à l'import."
            action={
              <Button leftIcon={<Plus size={16} />} onClick={() => setModal({ mode: "create" })}>
                Nouvelle règle
              </Button>
            }
          />
        </Card>
      ) : (
        <table className="table-transactions">
          <thead>
            <tr>
              <th>Active</th>
              <th>Nom</th>
              <th>Match</th>
              <th>Cible</th>
              <th>Compte</th>
              <th>Priorité</th>
              <th>Hits</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {localRules.map((rule) => (
              <tr key={rule.id} style={{ opacity: rule.is_active ? 1 : 0.55 }}>
                <td>
                  <Toggle
                    checked={rule.is_active}
                    onChange={() => toggleActive(rule)}
                    aria-label="Activer/désactiver"
                  />
                </td>
                <td style={{ fontWeight: "var(--fw-medium)" }}>{rule.name}</td>
                <td>
                  <span style={{ color: "var(--color-text-muted)", marginRight: "var(--space-2)" }}>
                    {MATCH_LABELS[rule.match_type]}
                  </span>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
                    {rule.pattern}
                  </code>
                </td>
                <td>{subLabels.get(rule.subcategory_id) ?? "—"}</td>
                <td>{rule.account_id ? accountNames.get(rule.account_id) ?? "—" : "Tous"}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{rule.priority}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{rule.hit_count}</td>
                <td>
                  <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
                    <IconButton label="Modifier" onClick={() => setModal({ mode: "edit", rule })}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton label="Supprimer" onClick={() => setToDelete(rule)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.mode === "edit" ? "Modifier la règle" : "Nouvelle règle"}
      >
        {modal && (
          <RuleForm
            mode={modal.mode}
            id={modal.mode === "edit" ? modal.rule.id : undefined}
            subcategoryOptions={subcategoryOptions}
            accountOptions={accountOptions}
            merchantOptions={merchantOptions}
            initial={
              modal.mode === "edit"
                ? {
                    name: modal.rule.name,
                    match_type: modal.rule.match_type,
                    pattern: modal.rule.pattern,
                    case_sensitive: modal.rule.case_sensitive,
                    amount_min: modal.rule.amount_min ?? "",
                    amount_max: modal.rule.amount_max ?? "",
                    account_id: modal.rule.account_id ?? "",
                    merchant_id: modal.rule.merchant_id ?? "",
                    subcategory_id: modal.rule.subcategory_id,
                    auto_validate: modal.rule.auto_validate,
                    priority: modal.rule.priority,
                    is_active: modal.rule.is_active,
                  }
                : undefined
            }
            onDone={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Supprimer la règle ?"
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
        <Alert variant="danger">
          Supprimer définitivement la règle <strong>{toDelete?.name}</strong> ?
        </Alert>
      </Modal>
    </>
  );
}
