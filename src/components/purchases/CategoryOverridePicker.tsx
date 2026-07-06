"use client";

import { Radio } from "@/components/ui/Checkbox";
import type { CategoryOverrideMode } from "@/lib/purchases/types";

/**
 * `category-override-picker` — choix de la politique de surcharge de la
 * catégorie des transactions rattachées quand la catégorie d'un achat change.
 * Trois options exclusives (`input-radio` + libellé + aide) : ne rien toucher,
 * ne surcharger que les transactions sans catégorie, ou toutes. Réutilisé dans
 * la modale du détail d'un achat (`purchase-detail-page`) et dans `PurchaseForm`.
 */
export function CategoryOverridePicker({
  value,
  onChange,
  count,
  name = "category-override",
}: {
  value: CategoryOverrideMode;
  onChange: (mode: CategoryOverrideMode) => void;
  /** Nombre de transactions rattachées (pour l'aide contextuelle). */
  count: number;
  /** Nom du groupe de radios (unique si plusieurs pickers sur la page). */
  name?: string;
}) {
  const options: { mode: CategoryOverrideMode; label: string; help: string }[] = [
    {
      mode: "empty",
      label: "Seulement les transactions sans catégorie",
      help: "Complète les manquantes, garde les catégories déjà définies.",
    },
    {
      mode: "all",
      label: "Toutes les transactions rattachées",
      help: `Écrase la catégorie des ${count} transaction${count > 1 ? "s" : ""}.`,
    },
    {
      mode: "none",
      label: "Ne pas surcharger",
      help: "Les transactions gardent leur catégorie actuelle.",
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Surcharger la catégorie des transactions rattachées"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
    >
      {options.map((o) => (
        <label
          key={o.mode}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-2)",
            cursor: "pointer",
          }}
        >
          <Radio
            name={name}
            checked={value === o.mode}
            onChange={() => onChange(o.mode)}
            style={{ marginTop: 2 }}
          />
          <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
              {o.label}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              {o.help}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
