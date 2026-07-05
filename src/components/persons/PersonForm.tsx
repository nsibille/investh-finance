"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/hooks/useToast";
import { createPerson, updatePerson } from "@/server/actions/persons";

/** Palette de pastilles proposée pour une personne. */
const COLORS = [
  "#5B5BD6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

export interface PersonFormInitial {
  name: string;
  color: string;
}

export function PersonForm({
  mode,
  id,
  initial,
  onDone,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: PersonFormInitial;
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
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
        ? await createPerson({ name, color })
        : await updatePerson(id!, { name, color });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(mode === "create" ? "Personne créée" : "Personne mise à jour");
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
          placeholder="Paul, Marie, Colocs…"
        />
      </FormField>

      <FormField label="Couleur">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => setColor(c)}
              data-selected={color === c}
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-full)",
                background: c,
                border:
                  color === c
                    ? "2px solid var(--color-text-primary)"
                    : "2px solid transparent",
                boxShadow: color === c ? "var(--shadow-sm)" : "none",
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
          marginTop: "var(--space-2)",
        }}
      >
        <Button type="button" variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" loading={saving}>
          {mode === "create" ? "Créer la personne" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
