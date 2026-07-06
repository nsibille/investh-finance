"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/Checkbox";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { useToast } from "@/hooks/useToast";
import { createMerchant, updateMerchant } from "@/server/actions/merchants";
import type { SubcategoryOption } from "@/lib/categories/types";

export interface MerchantFormInitial {
  name: string | null;
  subcategoryId: string | null;
  country: string | null;
  isOnline: boolean;
}

export function MerchantForm({
  mode,
  id,
  initial,
  subcategoryOptions,
  onDone,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: MerchantFormInitial;
  subcategoryOptions: SubcategoryOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [subcategoryId, setSubcategoryId] = useState<string | null>(
    initial?.subcategoryId ?? null,
  );
  const [country, setCountry] = useState(initial?.country ?? "");
  const [isOnline, setIsOnline] = useState(initial?.isOnline ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Le nom est requis.");
      return;
    }
    setSaving(true);
    const res =
      mode === "create"
        ? await createMerchant({ name, subcategoryId, country, isOnline })
        : await updateMerchant(id!, { name, subcategoryId, country, isOnline });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(mode === "create" ? "Enseigne créée" : "Enseigne mise à jour");
    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <FormField label="Nom commercial">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Carrefour, Amazon, SNCF…"
        />
      </FormField>

      <FormField label="Localisation">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Pays (ex. France)"
            disabled={isOnline}
          />
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
            <Checkbox checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
            En ligne (Internet)
          </label>
        </div>
      </FormField>

      <FormField label="Catégorie par défaut (appliquée aux transactions/achats rattachés, surchargeable)">
        <CategorySelect
          value={subcategoryId}
          options={subcategoryOptions}
          onChange={setSubcategoryId}
          allowCreate
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
        <Button type="submit" loading={saving}>
          {mode === "create" ? "Créer l'enseigne" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
