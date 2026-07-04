"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { useToast } from "@/hooks/useToast";
import { createPurchase, updatePurchase } from "@/server/actions/purchases";
import type { SubcategoryOption } from "@/lib/categories/types";

export interface PurchaseFormInitial {
  name: string;
  description: string | null;
  subcategoryId: string | null;
}

export function PurchaseForm({
  mode,
  id,
  initial,
  subcategoryOptions,
  onDone,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: PurchaseFormInitial;
  subcategoryOptions: SubcategoryOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
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
        ? await createPurchase({ name, description, subcategoryId })
        : await updatePurchase(id!, { name, description, subcategoryId });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(mode === "create" ? "Achat créé" : "Achat mis à jour");
    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <FormField label="Nom">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Canapé, MacBook, Voyage Japon…"
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Détails, vendeur, garantie…"
          rows={2}
        />
      </FormField>

      <FormField label="Catégorie (héritée par les transactions rattachées)">
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
          {mode === "create" ? "Créer l'achat" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
