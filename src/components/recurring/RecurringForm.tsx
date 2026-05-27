"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { recurringSchema, type RecurringInput } from "@/lib/recurring/schema";
import { FormField } from "@/components/ui/FormField";
import { Input, CurrencyInput } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import {
  createRecurringPattern,
  updateRecurringPattern,
} from "@/server/actions/recurring";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";

interface Props {
  mode: "create" | "edit";
  id?: string;
  initial?: Partial<RecurringInput>;
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
  onDone: () => void;
}

export function RecurringForm({
  mode,
  id,
  initial,
  accountOptions,
  subcategoryOptions,
  onDone,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecurringInput>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      name: initial?.name ?? "",
      account_id: initial?.account_id ?? "",
      subcategory_id: initial?.subcategory_id ?? "",
      expected_amount: initial?.expected_amount ?? "",
      amount_tolerance: initial?.amount_tolerance ?? 5,
      frequency_days: initial?.frequency_days ?? 30,
      label_pattern: initial?.label_pattern ?? "",
      alert_if_missing: initial?.alert_if_missing ?? true,
    },
  });

  async function onSubmit(values: RecurringInput) {
    setServerError(null);
    const res =
      mode === "create"
        ? await createRecurringPattern(values)
        : await updateRecurringPattern(id!, values);
    if (!res.ok) return setServerError(res.error);
    toast.success(mode === "create" ? "Récurrente créée" : "Récurrente mise à jour");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {serverError && <Alert variant="danger">{serverError}</Alert>}

      <FormField label="Nom" error={errors.name?.message}>
        <Input placeholder="Loyer, Salaire, Netflix…" invalid={!!errors.name} {...register("name")} />
      </FormField>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div style={{ flex: 1 }}>
          <FormField label="Compte (optionnel)">
            <Select {...register("account_id")}>
              <option value="">Tous les comptes</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Catégorie (optionnel)">
            <Select {...register("subcategory_id")}>
              <option value="">—</option>
              {subcategoryOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      <FormField label="Motif du libellé (optionnel)" help="Texte présent dans le libellé pour reconnaître l'opération (ex: NETFLIX).">
        <Input placeholder="NETFLIX" {...register("label_pattern")} />
      </FormField>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div style={{ flex: 1 }}>
          <FormField label="Montant attendu" error={errors.expected_amount?.message}>
            <CurrencyInput placeholder="—" {...register("expected_amount")} />
          </FormField>
        </div>
        <div style={{ width: 120 }}>
          <FormField label="Tolérance %">
            <Input type="number" {...register("amount_tolerance")} />
          </FormField>
        </div>
        <div style={{ width: 130 }}>
          <FormField label="Fréquence (jours)">
            <Input type="number" {...register("frequency_days")} />
          </FormField>
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
        <Toggle {...register("alert_if_missing")} />
        Alerter si l&apos;opération est manquante
      </label>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <Button type="button" variant="secondary" onClick={onDone}>Annuler</Button>
        <Button type="submit" loading={isSubmitting}>
          {mode === "create" ? "Créer" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
