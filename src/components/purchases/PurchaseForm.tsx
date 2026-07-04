"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { useToast } from "@/hooks/useToast";
import { createPurchase, updatePurchase } from "@/server/actions/purchases";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";

export interface PurchaseFormInitial {
  name: string;
  description: string | null;
  subcategoryId: string | null;
  merchantId: string | null;
}

export function PurchaseForm({
  mode,
  id,
  initial,
  subcategoryOptions,
  merchantOptions,
  onDone,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: PurchaseFormInitial;
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [subcategoryId, setSubcategoryId] = useState<string | null>(
    initial?.subcategoryId ?? null,
  );
  const [merchantId, setMerchantId] = useState<string | null>(
    initial?.merchantId ?? null,
  );

  // Choisir une enseigne pré-remplit la catégorie avec sa catégorie par défaut
  // (surchargeable : l'utilisateur peut ensuite changer la catégorie).
  function onMerchantChange(value: string) {
    const next = value || null;
    setMerchantId(next);
    const merchant = merchantOptions.find((m) => m.id === next);
    if (merchant?.subcategoryId) setSubcategoryId(merchant.subcategoryId);
  }
  // Plan de mensualités (création uniquement) — direct si count vide/0.
  const [count, setCount] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [monthly, setMonthly] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Le nom est requis.");
      return;
    }
    const n = parseInt(count, 10);
    const amount = parseFloat(monthly.replace(",", "."));
    const installmentPlan =
      mode === "create" && n > 0 && startMonth && Number.isFinite(amount)
        ? { count: n, startMonth, amount: -Math.abs(amount) }
        : null;
    setSaving(true);
    const res =
      mode === "create"
        ? await createPurchase({ name, description, subcategoryId, merchantId, installmentPlan })
        : await updatePurchase(id!, { name, description, subcategoryId, merchantId });
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

      {merchantOptions.length > 0 && (
        <FormField label="Enseigne (optionnel — pré-remplit la catégorie)">
          <Select value={merchantId ?? ""} onChange={(e) => onMerchantChange(e.target.value)}>
            <option value="">Aucune</option>
            {merchantOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label="Catégorie (héritée par les transactions rattachées)">
        <CategorySelect
          value={subcategoryId}
          options={subcategoryOptions}
          onChange={setSubcategoryId}
          allowCreate
        />
      </FormField>

      {mode === "create" && (
        <FormField label="Mensualités (optionnel — laisser vide pour un achat direct)">
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <Input
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="Nombre"
              style={{ maxWidth: 100 }}
            />
            <span style={{ color: "var(--color-text-muted)" }}>×</span>
            <Input
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              placeholder="Montant /mois"
              style={{ maxWidth: 130 }}
            />
            <span style={{ color: "var(--color-text-muted)" }}>dès</span>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="input-text-md"
              style={{ maxWidth: 150 }}
            />
          </div>
        </FormField>
      )}

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
