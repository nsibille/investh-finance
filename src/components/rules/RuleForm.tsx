"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ruleSchema, type RuleInput } from "@/lib/rules/schema";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { createRule, updateRule } from "@/server/actions/rules";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { AccountOption } from "@/lib/rules/queries";

interface RuleFormProps {
  mode: "create" | "edit";
  id?: string;
  initial?: Partial<RuleInput>;
  subcategoryOptions: SubcategoryOption[];
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
  initial,
  subcategoryOptions,
  accountOptions,
  onDone,
}: RuleFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
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
      subcategory_id: initial?.subcategory_id ?? "",
      auto_validate: initial?.auto_validate ?? true,
      priority: initial?.priority ?? 100,
      is_active: initial?.is_active ?? true,
    },
  });

  async function onSubmit(values: RuleInput) {
    setServerError(null);
    const res =
      mode === "create"
        ? await createRule(values)
        : await updateRule(id!, values);
    if (!res.ok) return setServerError(res.error);
    toast.success(mode === "create" ? "Règle créée" : "Règle mise à jour");
    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {serverError && <Alert variant="danger">{serverError}</Alert>}

      <FormField label="Nom de la règle" error={errors.name?.message}>
        <Input placeholder="Carrefour → Courses" invalid={!!errors.name} {...register("name")} />
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

      <FormField label="Sous-catégorie cible" error={errors.subcategory_id?.message}>
        <Select invalid={!!errors.subcategory_id} {...register("subcategory_id")}>
          <option value="">Choisir…</option>
          {subcategoryOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>

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
            <Input type="number" step="0.01" placeholder="—" {...register("amount_min")} />
          </FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Montant max (optionnel)" error={errors.amount_max?.message}>
            <Input type="number" step="0.01" placeholder="—" {...register("amount_max")} />
          </FormField>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <ToggleField label="Sensible à la casse" {...register("case_sensitive")} />
        <ToggleField label="Valider automatiquement les transactions matchées" {...register("auto_validate")} />
        <ToggleField label="Règle active" {...register("is_active")} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {mode === "create" ? "Créer la règle" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
