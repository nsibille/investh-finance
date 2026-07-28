"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";
import { FormField } from "@/components/ui/FormField";
import { Input, CurrencyInput } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { saveRule } from "@/server/actions/rules";
import type { RuleApplyScope } from "@/server/rules/apply";
import type { AccountOption } from "@/lib/rules/queries";

interface RuleFormProps {
  mode: "create" | "edit";
  id?: string;
  /** Enseigne propriétaire du motif (verrouillée : la catégorie en est héritée). */
  merchantId: string;
  merchantName?: string | null;
  initial?: Partial<RuleInput>;
  accountOptions: AccountOption[];
  onDone: () => void;
}

function ToggleField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
      }}
    >
      <Toggle {...props} />
      {label}
    </label>
  );
}

export function RuleForm({
  mode,
  id,
  merchantId,
  merchantName,
  initial,
  accountOptions,
  onDone,
}: RuleFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittingScope, setSubmittingScope] = useState<RuleApplyScope | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RuleInput>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: initial?.name ?? "",
      match_type: initial?.match_type ?? "regex",
      pattern: initial?.pattern ?? "",
      case_sensitive: initial?.case_sensitive ?? false,
      amount_min: initial?.amount_min ?? "",
      amount_max: initial?.amount_max ?? "",
      account_id: initial?.account_id ?? "",
      // Enseigne propriétaire verrouillée : la catégorie du motif en est héritée.
      merchant_id: merchantId,
      auto_validate: initial?.auto_validate ?? true,
      priority: initial?.priority ?? 100,
      is_active: initial?.is_active ?? true,
    },
  });

  async function onSubmit(values: RuleInput, scope: RuleApplyScope) {
    setServerError(null);
    setSubmittingScope(scope);
    const res = await saveRule(
      { ...values, merchant_id: merchantId },
      { id: mode === "edit" ? id : undefined, applyScope: scope },
    );
    setSubmittingScope(null);
    if (!res.ok) return setServerError(res.error);
    const base = mode === "create" ? "Motif créé" : "Motif mis à jour";
    toast.success(
      res.applied > 0
        ? `${base} · appliqué à ${res.applied} transaction${res.applied > 1 ? "s" : ""}`
        : base,
    );
    router.refresh();
    onDone();
  }

  const busy = submittingScope !== null;
  const saveVerb = mode === "create" ? "Créer" : "Enregistrer";

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(v, "none"))}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {serverError && <Alert variant="danger">{serverError}</Alert>}

      <Alert variant="info">
        Motif de l&apos;enseigne{" "}
        <strong>{merchantName?.trim() || "Sans enseigne"}</strong> — la catégorie
        est héritée de l&apos;enseigne.
      </Alert>

      <FormField label="Nom du motif" error={errors.name?.message}>
        <Input placeholder="CB CARREFOUR" invalid={!!errors.name} {...register("name")} />
      </FormField>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div style={{ width: 160 }}>
          <FormField label="Type de match" error={errors.match_type?.message}>
            <Select {...register("match_type")}>
              <option value="regex">Regex</option>
              <option value="contains">Contient</option>
              <option value="exact">Exact</option>
            </Select>
          </FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Motif" error={errors.pattern?.message}>
            <Input placeholder="^CB CARREFOUR" invalid={!!errors.pattern} {...register("pattern")} />
          </FormField>
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div style={{ flex: 1 }}>
          <FormField label="Compte (optionnel)" error={errors.account_id?.message}>
            <Select {...register("account_id")}>
              <option value="">Tous les comptes</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div style={{ width: 110 }}>
          <FormField label="Priorité" error={errors.priority?.message}>
            <Input type="number" invalid={!!errors.priority} {...register("priority")} />
          </FormField>
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div style={{ flex: 1 }}>
          <FormField label="Montant min (optionnel)" error={errors.amount_min?.message}>
            <CurrencyInput placeholder="—" {...register("amount_min")} />
          </FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Montant max (optionnel)" error={errors.amount_max?.message}>
            <CurrencyInput placeholder="—" {...register("amount_max")} />
          </FormField>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <ToggleField label="Sensible à la casse" {...register("case_sensitive")} />
        <ToggleField label="Valider automatiquement les transactions matchées" {...register("auto_validate")} />
        <ToggleField label="Motif actif" {...register("is_active")} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
          Annuler
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={submittingScope === "none"}
          disabled={busy}
          onClick={handleSubmit((v) => onSubmit(v, "none"))}
        >
          {saveVerb}
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={submittingScope === "uncategorized"}
          disabled={busy}
          onClick={handleSubmit((v) => onSubmit(v, "uncategorized"))}
        >
          {saveVerb} + appliquer aux non catégorisées
        </Button>
        <Button
          type="button"
          loading={submittingScope === "all"}
          disabled={busy}
          onClick={handleSubmit((v) => onSubmit(v, "all"))}
        >
          {saveVerb} + appliquer à toutes
        </Button>
      </div>
    </form>
  );
}
