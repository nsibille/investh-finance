"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/Checkbox";
import { CountBadge } from "@/components/ui/Badge";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { useToast } from "@/hooks/useToast";
import {
  getCategoryDeletionImpact,
  deleteCategory,
  type CategoryDeletionImpact,
} from "@/server/actions/categories";
import type { SubcategoryOption } from "@/lib/categories/types";

export function CategoryDeleteModal({
  categoryId,
  categoryName,
  subcategoryOptions,
  onClose,
}: {
  categoryId: string;
  categoryName: string;
  subcategoryOptions: SubcategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [impact, setImpact] = useState<CategoryDeletionImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [useSubstitute, setUseSubstitute] = useState(false);
  const [substituteId, setSubstituteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getCategoryDeletionImpact(categoryId).then((res) => {
      if (!alive) return;
      if (res.ok) setImpact(res.impact);
      else toast.error(res.error);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [categoryId, toast]);

  // Substitution : exclure les sous-catégories de la catégorie supprimée.
  const substituteOptions = useMemo(
    () =>
      subcategoryOptions.filter(
        (o) => !impact?.subcategoryIds.includes(o.id),
      ),
    [subcategoryOptions, impact],
  );

  const rows = impact
    ? [
        { key: "rules", label: "Règles", count: impact.rules, danger: true },
        { key: "merchants", label: "Enseignes", count: impact.merchants },
        { key: "recurring", label: "Récurrences", count: impact.recurring },
        { key: "transactions", label: "Transactions", count: impact.transactions },
        { key: "purchases", label: "Achats", count: impact.purchases },
      ].filter((r) => r.count > 0)
    : [];
  const total = rows.reduce((s, r) => s + r.count, 0);

  async function confirm() {
    if (useSubstitute && !substituteId)
      return toast.error("Choisis une catégorie de substitution.");
    setBusy(true);
    const res = await deleteCategory(
      categoryId,
      useSubstitute ? substituteId : null,
    );
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Catégorie supprimée");
    router.refresh();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Supprimer la catégorie ?"
      variantClass="modal-confirm-danger"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" loading={busy} disabled={loading} onClick={confirm}>
            Supprimer
          </Button>
        </>
      }
    >
      {loading ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Analyse des rattachements de <strong>{categoryName}</strong>…
        </p>
      ) : impact ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Alert variant="danger">
            Supprimer définitivement <strong>{impact.categoryName}</strong> et ses
            sous-catégories&nbsp;?
          </Alert>

          {total === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: 0 }}>
              Aucun objet rattaché : suppression sans impact.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
                  Objets rattachés
                </span>
                {rows.map((r) => (
                  <div key={r.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                    <span>{r.label}</span>
                    <CountBadge count={r.count} />
                  </div>
                ))}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                <Checkbox
                  checked={useSubstitute}
                  onChange={(e) => setUseSubstitute(e.target.checked)}
                />
                Réaffecter ces objets à une autre catégorie
              </label>

              {useSubstitute ? (
                <CategorySelect
                  value={substituteId}
                  options={substituteOptions}
                  onChange={setSubstituteId}
                  placeholder="Choisir une catégorie de substitution"
                />
              ) : (
                <Alert variant="warning">
                  Sans réaffectation&nbsp;:{" "}
                  {impact.rules > 0 && (
                    <>les {impact.rules} règle{impact.rules > 1 ? "s" : ""} seront{" "}
                    <strong>supprimées</strong> ; </>
                  )}
                  les transactions, achats, enseignes et récurrences rattachés
                  seront décatégorisés.
                </Alert>
              )}
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
