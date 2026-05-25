"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import {
  createSubcategory,
  updateSubcategory,
} from "@/server/actions/categories";

interface SubcategoryFormProps {
  categoryId: string;
  mode: "create" | "edit";
  id?: string;
  initialName?: string;
  onDone: () => void;
}

export function SubcategoryForm({
  categoryId,
  mode,
  id,
  initialName = "",
  onDone,
}: SubcategoryFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res =
      mode === "create"
        ? await createSubcategory({ category_id: categoryId, name })
        : await updateSubcategory(id!, name);
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    toast.success(mode === "create" ? "Sous-catégorie créée" : "Sous-catégorie mise à jour");
    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <FormField label="Nom de la sous-catégorie">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Intérêts"
        />
      </FormField>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-3)",
        }}
      >
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" loading={submitting}>
          {mode === "create" ? "Créer" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
