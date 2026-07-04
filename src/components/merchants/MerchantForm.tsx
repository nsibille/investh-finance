"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { useToast } from "@/hooks/useToast";
import { createMerchant, updateMerchant } from "@/server/actions/merchants";
import type { SubcategoryOption } from "@/lib/categories/types";

export interface MerchantFormInitial {
  name: string;
  subcategoryId: string | null;
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
        ? await createMerchant({ name, subcategoryId })
        : await updateMerchant(id!, { name, subcategoryId });
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
