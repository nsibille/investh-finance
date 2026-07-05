"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Checkbox";
import { CategorySelect } from "./CategorySelect";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { fullPattern } from "@/lib/rules/suggester";
import {
  createRuleFromTransaction,
  previewRuleMatches,
  type RuleApplyScope,
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
  merchantId,
  merchantName,
  onDone,
}: {
  transactionId: string;
  rawLabel: string;
  accountId: string;
  defaultSubcategoryId: string | null;
  subcategoryOptions: SubcategoryOption[];
  /** Si fourni, la règle rattache aussi les transactions à cette enseigne. */
  merchantId?: string | null;
  merchantName?: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(rawLabel.slice(0, 60));
  const [matchType, setMatchType] = useState<"regex" | "contains" | "exact">("regex");
  const [pattern, setPattern] = useState(fullPattern(rawLabel));
  const [subcategoryId, setSubcategoryId] = useState(defaultSubcategoryId ?? "");
  const [autoValidate, setAutoValidate] = useState(true);
  const [scopeToAccount, setScopeToAccount] = useState(true);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingScope, setSubmittingScope] = useState<RuleApplyScope | null>(
    null,
  );

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

  async function submit(scope: RuleApplyScope) {
    setError(null);
    if (!subcategoryId) {
      setError("Choisis une sous-catégorie cible.");
      return;
    }
    setSubmittingScope(scope);
    const input: RuleInput = {
      name,
      match_type: matchType,
      pattern,
      case_sensitive: false,
      amount_min: "",
      amount_max: "",
      account_id: scopeToAccount ? accountId : "",
      merchant_id: merchantId ?? "",
      subcategory_id: subcategoryId,
      auto_validate: autoValidate,
      priority: 100,
      is_active: true,
    };
    const res = await createRuleFromTransaction(input, {
      transactionId,
      applyScope: scope,
    });
    setSubmittingScope(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(
      res.applied > 0
        ? `Règle créée · appliquée à ${res.applied} transaction${res.applied > 1 ? "s" : ""}`
        : "Règle créée",
    );
    router.refresh();
    onDone();
  }

  const busy = submittingScope !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {error && <Alert variant="danger">{error}</Alert>}

      {merchantId && (
        <Alert variant="info">
          Les transactions matchées seront aussi rattachées à l&apos;enseigne
          {merchantName ? ` « ${merchantName} »` : ""}.
        </Alert>
      )}

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
        <CategorySelect
          value={subcategoryId || null}
          options={subcategoryOptions}
          placeholder="Choisir une catégorie…"
          allowCreate
          onChange={(id) => setSubcategoryId(id ?? "")}
        />
      </FormField>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <ToggleField label="Valider automatiquement les transactions matchées" checked={autoValidate} onChange={setAutoValidate} />
        <ToggleField label="Limiter à ce compte" checked={scopeToAccount} onChange={setScopeToAccount} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={submittingScope === "none"}
            disabled={busy}
            onClick={() => submit("none")}
          >
            Créer la règle
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={submittingScope === "uncategorized"}
            disabled={busy}
            onClick={() => submit("uncategorized")}
          >
            Créer + appliquer aux non catégorisées
          </Button>
          <Button
            type="button"
            loading={submittingScope === "all"}
            disabled={busy}
            onClick={() => submit("all")}
          >
            Créer + appliquer à toutes
          </Button>
        </div>
      </div>
    </div>
  );
}
