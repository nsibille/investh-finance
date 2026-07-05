"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { recurringSchema, type RecurringInput } from "@/lib/recurring/schema";
import { FormField } from "@/components/ui/FormField";
import { Input, CurrencyInput } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { IconButton } from "@/components/ui/IconButton";
import { Plus, X } from "lucide-react";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { MerchantSelect } from "@/components/merchants/MerchantSelect";
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
import type { MerchantOption } from "@/lib/merchants/types";

interface Props {
  mode: "create" | "edit";
  id?: string;
  initial?: Partial<RecurringInput>;
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  onDone: () => void;
}

const FREQ_PRESETS: { label: string; days: number }[] = [
  { label: "Hebdomadaire", days: 7 },
  { label: "Toutes les 2 semaines", days: 14 },
  { label: "Mensuel", days: 30 },
  { label: "Bimestriel", days: 60 },
  { label: "Trimestriel", days: 90 },
  { label: "Semestriel", days: 182 },
  { label: "Annuel", days: 365 },
];

export function RecurringForm({
  mode,
  id,
  initial,
  accountOptions,
  subcategoryOptions,
  merchantOptions,
  onDone,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const initialDays = Number(initial?.frequency_days ?? 30) || 30;
  const [customFreq, setCustomFreq] = useState(
    !FREQ_PRESETS.some((p) => p.days === initialDays),
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecurringInput>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      name: initial?.name ?? "",
      account_id: initial?.account_id ?? "",
      merchant_id: initial?.merchant_id ?? "",
      subcategory_id: initial?.subcategory_id ?? "",
      expected_amount: initial?.expected_amount ?? "",
      expected_amounts: initial?.expected_amounts ?? [],
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
            <Controller
              control={control}
              name="subcategory_id"
              render={({ field }) => (
                <CategorySelect
                  value={(field.value as string) || null}
                  options={subcategoryOptions}
                  placeholder="Aucune catégorie"
                  allowCreate
                  onChange={(id) => field.onChange(id ?? "")}
                />
              )}
            />
          </FormField>
        </div>
      </div>

      <FormField label="Enseigne (optionnel — pré-remplit la catégorie et rattache les transactions)">
        <Controller
          control={control}
          name="merchant_id"
          render={({ field }) => (
            <MerchantSelect
              value={(field.value as string) || null}
              options={merchantOptions}
              onChange={(id, opt) => {
                field.onChange(id ?? "");
                if (opt?.subcategoryId) setValue("subcategory_id", opt.subcategoryId);
              }}
            />
          )}
        />
      </FormField>

      <FormField label="Motifs du libellé (optionnel)" help="Un motif par ligne — la transaction matche si l'un d'eux est présent (ex: NETFLIX).">
        <Textarea placeholder={"NETFLIX\nNETFLIX.COM"} rows={2} {...register("label_pattern")} />
      </FormField>

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <FormField label="Montants attendus" help="Plusieurs possibles (le prix d'un abonnement peut changer).">
            <Controller
              control={control}
              name="expected_amounts"
              render={({ field }) => {
                const raw = Array.isArray(field.value) ? field.value.map(String) : [];
                const values = raw.length ? raw : [""];
                const setAll = (next: string[]) => field.onChange(next);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {values.map((v, i) => (
                      <div key={i} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                        <CurrencyInput
                          placeholder="—"
                          value={v}
                          onChange={(e) => {
                            const next = [...values];
                            next[i] = e.target.value;
                            setAll(next);
                          }}
                        />
                        {values.length > 1 && (
                          <IconButton label="Retirer ce montant" onClick={() => setAll(values.filter((_, j) => j !== i))}>
                            <X size={14} />
                          </IconButton>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAll([...values, ""])}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", background: "none", border: "none", padding: 0, fontSize: "var(--text-sm)", color: "var(--color-brand-primary-600)", cursor: "pointer" }}
                    >
                      <Plus size={14} aria-hidden /> Ajouter un montant
                    </button>
                  </div>
                );
              }}
            />
          </FormField>
        </div>
        <div style={{ width: 120 }}>
          <FormField label="Tolérance %">
            <Input type="number" {...register("amount_tolerance")} />
          </FormField>
        </div>
      </div>

      <FormField label="Fréquence" error={errors.frequency_days?.message}>
        <Controller
          control={control}
          name="frequency_days"
          render={({ field }) => {
            const days = Number(field.value) || 0;
            return (
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                <Select
                  value={customFreq ? "custom" : String(days)}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setCustomFreq(true);
                    } else {
                      setCustomFreq(false);
                      field.onChange(Number(e.target.value));
                    }
                  }}
                  style={{ maxWidth: 240 }}
                >
                  {FREQ_PRESETS.map((p) => (
                    <option key={p.days} value={p.days}>
                      {p.label} ({p.days} j)
                    </option>
                  ))}
                  <option value="custom">Personnalisé…</option>
                </Select>
                {customFreq && (
                  <Input
                    type="number"
                    min={1}
                    max={400}
                    value={days || ""}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    placeholder="jours"
                    style={{ width: 100 }}
                  />
                )}
              </div>
            );
          }}
        />
      </FormField>

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
