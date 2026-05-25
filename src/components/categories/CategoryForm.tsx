"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { ACCOUNT_COLORS } from "@/lib/accounts/constants";
import {
  createCategory,
  updateCategory,
} from "@/server/actions/categories";

interface CategoryFormProps {
  typeId: string;
  mode: "create" | "edit";
  id?: string;
  initialName?: string;
  initialColor?: string | null;
  onDone: () => void;
}

export function CategoryForm({
  typeId,
  mode,
  id,
  initialName = "",
  initialColor,
  onDone,
}: CategoryFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload = { category_type_id: typeId, name, color };
    const res =
      mode === "create"
        ? await createCategory(payload)
        : await updateCategory(id!, payload);
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    toast.success(mode === "create" ? "Catégorie créée" : "Catégorie mise à jour");
    router.refresh();
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <FormField label="Nom de la catégorie">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Courses"
        />
      </FormField>
      <FormField label="Couleur (optionnelle)">
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setColor("")}
            aria-label="Aucune couleur"
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg-subtle)",
              border:
                color === ""
                  ? "2px solid var(--color-text-primary)"
                  : "2px solid var(--color-border)",
              cursor: "pointer",
            }}
          />
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-md)",
                background: c,
                border:
                  color === c
                    ? "2px solid var(--color-text-primary)"
                    : "2px solid transparent",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
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
