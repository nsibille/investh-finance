"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { MerchantSelect } from "@/components/merchants/MerchantSelect";
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
  installmentsEditor,
  onDone,
}: {
  mode: "create" | "edit";
  id?: string;
  initial?: PurchaseFormInitial;
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  /** Éditeur de mensualités affiché en mode édition (l'échéancier n'est
   *  paramétrable à la volée qu'en création ; en édition on gère ligne à ligne). */
  installmentsEditor?: ReactNode;
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

  // Échéancier (création uniquement).
  const [planKind, setPlanKind] = useState<"none" | "installments" | "recurring">("none");
  const [count, setCount] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [monthly, setMonthly] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [noEnd, setNoEnd] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Le nom est requis.");
      return;
    }
    const amount = parseFloat(monthly.replace(",", "."));
    const n = parseInt(count, 10);
    let installmentPlan = null;
    let recurrencePlan = null;
    if (mode === "create" && planKind === "installments") {
      if (n > 0 && startMonth && Number.isFinite(amount)) {
        installmentPlan = { count: n, startMonth, amount: -Math.abs(amount) };
      }
    } else if (mode === "create" && planKind === "recurring") {
      if (startMonth && Number.isFinite(amount)) {
        recurrencePlan = {
          amount: -Math.abs(amount),
          startMonth,
          endMonth: noEnd ? null : endMonth || null,
        };
      }
    }
    setSaving(true);
    const res =
      mode === "create"
        ? await createPurchase({ name, description, subcategoryId, merchantId, installmentPlan, recurrencePlan })
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

      <FormField label="Enseigne (optionnel — pré-remplit la catégorie)">
        <MerchantSelect
          value={merchantId}
          options={merchantOptions}
          onChange={(id, opt) => {
            setMerchantId(id);
            if (opt?.subcategoryId) setSubcategoryId(opt.subcategoryId);
          }}
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

      {mode === "create" && (
        <FormField label="Échéancier">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Select value={planKind} onChange={(e) => setPlanKind(e.target.value as typeof planKind)}>
              <option value="none">Achat direct (aucune échéance)</option>
              <option value="installments">Paiement en plusieurs fois</option>
              <option value="recurring">Récurrent (abonnement, loyer…)</option>
            </Select>

            {planKind === "installments" && (
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
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
            )}

            {planKind === "recurring" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
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
                  {!noEnd && (
                    <>
                      <span style={{ color: "var(--color-text-muted)" }}>jusqu&apos;à</span>
                      <input
                        type="month"
                        value={endMonth}
                        onChange={(e) => setEndMonth(e.target.value)}
                        className="input-text-md"
                        style={{ maxWidth: 150 }}
                      />
                    </>
                  )}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                  <Checkbox checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} />
                  Sans fin (abonnement)
                </label>
              </div>
            )}
          </div>
        </FormField>
      )}

      {mode === "edit" && installmentsEditor && (
        <FormField label="Échéancier">{installmentsEditor}</FormField>
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
