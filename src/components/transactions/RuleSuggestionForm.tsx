"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { suggestPattern } from "@/lib/rules/suggester";
import {
  createRuleFromTransaction,
  previewRuleMatches,
} from "@/server/actions/transactions";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { RuleInput } from "@/lib/rules/schema";

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
      <Toggle checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function RuleSuggestionForm({
  transactionId,
  rawLabel,
  accountId,
  defaultSubcategoryId,
  subcategoryOptions,
  onDone,
}: {
  transactionId: string;
  rawLabel: string;
  accountId: string;
  defaultSubcategoryId: string | null;
  subcategoryOptions: SubcategoryOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(rawLabel.slice(0, 60));
  const [matchType, setMatchType] = useState<"regex" | "contains" | "exact">("regex");
  const [pattern, setPattern] = useState(suggestPattern(rawLabel));
  const [subcategoryId, setSubcategoryId] = useState(defaultSubcategoryId ?? "");
  const [autoValidate, setAutoValidate] = useState(true);
  const [scopeToAccount, setScopeToAccount] = useState(true);
  const [applyToPending, setApplyToPending] = useState(true);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const count = await previewRuleMatches({
        match_type: matchType,
        pattern,
        case_sensitive: false,
        account_id: scopeToAccount ? accountId : "",
      });
      if (active) setMatchCount(count);
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pattern, matchType, scopeToAccount, accountId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subcategoryId) {
      setError("Choisis une sous-catégorie cible.");
      return;
    }
    setSubmitting(true);
    const input: RuleInput = {
      name,
      match_type: matchType,
      pattern,
      case_sensitive: false,
      amount_min: "",
      amount_max: "",
      account_id: scopeToAccount ? accountId : "",
      subcategory_id: subcategoryId,
      auto_validate: autoValidate,
      priority: 100,
      is_active: true,
    };
    const res = await createRuleFromTransaction(input, {
      transactionId,
      applyToPending,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Règle créée");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {error && <Alert variant="danger">{error}</Alert>}

      <FormField label="Libellé d'origine">
        <div
          style={{
            padding: "var(--space-3)",
            background: "var(--color-bg-subtle)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            wordBreak: "break-all",
          }}
        >
          {rawLabel}
        </div>
      </FormField>

      <FormField label="Nom de la règle">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div style={{ width: 150 }}>
          <FormField label="Type">
            <Select value={matchType} onChange={(e) => setMatchType(e.target.value as typeof matchType)}>
              <option value="regex">Regex</option>
              <option value="contains">Contient</option>
              <option value="exact">Exact</option>
            </Select>
          </FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Motif" help={matchCount != null ? `Cette règle correspond à ${matchCount} transaction(s) existante(s)` : undefined}>
            <Input value={pattern} onChange={(e) => setPattern(e.target.value)} />
          </FormField>
        </div>
      </div>

      <FormField label="Sous-catégorie cible">
        <Select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
          <option value="">Choisir…</option>
          {subcategoryOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>
      </FormField>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <ToggleField label="Valider automatiquement les transactions matchées" checked={autoValidate} onChange={setAutoValidate} />
        <ToggleField label="Limiter à ce compte" checked={scopeToAccount} onChange={setScopeToAccount} />
        <ToggleField label="Appliquer aux transactions à valider existantes" checked={applyToPending} onChange={setApplyToPending} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" loading={submitting}>Créer la règle</Button>
      </div>
    </form>
  );
}
