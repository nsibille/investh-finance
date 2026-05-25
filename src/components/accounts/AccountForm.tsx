"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { accountSchema, type AccountInput } from "@/lib/accounts/schema";
import {
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_COLORS,
} from "@/lib/accounts/constants";
import { FormField } from "@/components/ui/FormField";
import { Input, CurrencyInput, DateInput } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import {
  createAccount,
  updateAccount,
} from "@/server/actions/accounts";

export interface AccountFormProps {
  mode: "create" | "edit";
  id?: string;
  initial?: Partial<AccountInput>;
  onDone: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AccountForm({ mode, id, initial, onDone }: AccountFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: initial?.name ?? "",
      type: initial?.type ?? "checking",
      bank: initial?.bank ?? "",
      initial_balance: initial?.initial_balance ?? 0,
      initial_date: initial?.initial_date ?? todayISO(),
      currency: initial?.currency ?? "EUR",
      color: initial?.color ?? ACCOUNT_COLORS[0],
    },
  });

  async function onSubmit(values: AccountInput) {
    setServerError(null);
    const res =
      mode === "create"
        ? await createAccount(values)
        : await updateAccount(id!, values);

    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    toast.success(
      mode === "create" ? "Compte créé" : "Compte mis à jour",
    );
    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {serverError && <Alert variant="danger">{serverError}</Alert>}

      <FormField label="Nom du compte" error={errors.name?.message}>
        <Input
          placeholder="Compte courant"
          invalid={!!errors.name}
          {...register("name")}
        />
      </FormField>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div style={{ flex: 1 }}>
          <FormField label="Type" error={errors.type?.message}>
            <Select invalid={!!errors.type} {...register("type")}>
              {ACCOUNT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Banque" error={errors.bank?.message}>
            <Input placeholder="Boursorama…" {...register("bank")} />
          </FormField>
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div style={{ flex: 1 }}>
          <FormField label="Solde initial" error={errors.initial_balance?.message}>
            <CurrencyInput
              placeholder="0,00"
              invalid={!!errors.initial_balance}
              {...register("initial_balance")}
            />
          </FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="À la date du" error={errors.initial_date?.message}>
            <DateInput invalid={!!errors.initial_date} {...register("initial_date")} />
          </FormField>
        </div>
        <div style={{ width: 90 }}>
          <FormField label="Devise" error={errors.currency?.message}>
            <Input maxLength={3} invalid={!!errors.currency} {...register("currency")} />
          </FormField>
        </div>
      </div>

      <FormField label="Couleur">
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Couleur ${c}`}
                  onClick={() => field.onChange(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-md)",
                    background: c,
                    border:
                      field.value === c
                        ? "2px solid var(--color-text-primary)"
                        : "2px solid transparent",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          )}
        />
      </FormField>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-3)",
          marginTop: "var(--space-2)",
        }}
      >
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {mode === "create" ? "Créer le compte" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
