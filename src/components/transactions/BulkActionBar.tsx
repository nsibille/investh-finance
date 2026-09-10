"use client";

import { useState } from "react";
import { ShoppingBag, Store, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { CategorySelect } from "./CategorySelect";
import { PurchaseAttachModal } from "@/components/import/PurchaseAttachModal";
import { MerchantAttachModal } from "@/components/import/MerchantAttachModal";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { PurchaseOption } from "@/lib/purchases/types";
import type { MerchantOption } from "@/lib/merchants/types";

/** Actions de modification groupée (clés = index d'aperçu ou id de transaction). */
export interface BulkHandlers {
  onBulkAssignCategory: (keys: string[], subcategoryId: string | null) => void;
  onBulkAttachMerchant: (keys: string[], option: MerchantOption) => void;
  onBulkAttachPurchase: (keys: string[], option: PurchaseOption) => void;
  /** Catégorie créée à la volée depuis la modale groupée (à ajouter aux options). */
  onCategoryCreated?: (option: SubcategoryOption) => void;
}

/**
 * `bulk-action-bar` — barre de modification groupée affichée au-dessus d'une
 * table quand ≥ 1 ligne est cochée : case « tout » (indéterminée si sélection
 * partielle), compteur, actions Catégorie / Enseigne / Achat (chacune ouvre le
 * sélecteur habituel puis applique à toute la sélection), désélection.
 */
export function BulkActionBar({
  selectedKeys,
  visibleCount,
  onToggleAll,
  onClear,
  handlers,
  subcategoryOptions,
  merchantOptions,
  purchaseOptions,
}: {
  selectedKeys: string[];
  /** Nombre de lignes visibles (cible de « tout sélectionner »). */
  visibleCount: number;
  onToggleAll: () => void;
  onClear: () => void;
  handlers: BulkHandlers;
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  purchaseOptions: PurchaseOption[];
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState<string | null>(null);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const count = selectedKeys.length;
  if (count === 0) return null;
  const all = count >= visibleCount;

  function applyCategory() {
    handlers.onBulkAssignCategory(selectedKeys, categoryValue);
    setCategoryOpen(false);
    setCategoryValue(null);
  }

  return (
    <>
      <div className="bulk-action-bar" role="toolbar" aria-label="Modification groupée">
        <label className="bulk-action-bar__all">
          <Checkbox
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = !all && count > 0;
            }}
            onChange={onToggleAll}
            aria-label={all ? "Tout désélectionner" : "Tout sélectionner"}
          />
          <span className="bulk-action-bar__count">
            {count} sélectionnée{count > 1 ? "s" : ""}
          </span>
        </label>

        <div className="bulk-action-bar__actions">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Tag size={14} aria-hidden />}
            onClick={() => setCategoryOpen(true)}
          >
            Catégorie…
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Store size={14} aria-hidden />}
            onClick={() => setMerchantOpen(true)}
          >
            Enseigne…
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ShoppingBag size={14} aria-hidden />}
            onClick={() => setPurchaseOpen(true)}
          >
            Achat…
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          leftIcon={<X size={14} aria-hidden />}
          onClick={onClear}
        >
          Désélectionner
        </Button>
      </div>

      <Modal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title={`Catégoriser ${count} transaction${count > 1 ? "s" : ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCategoryOpen(false)}>
              Annuler
            </Button>
            <Button onClick={applyCategory}>Appliquer</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <CategorySelect
            value={categoryValue}
            options={subcategoryOptions}
            onChange={setCategoryValue}
            allowCreate
            onCreated={handlers.onCategoryCreated}
          />
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
            Les transactions rattachées à un achat gardent la catégorie de l&apos;achat.
          </p>
        </div>
      </Modal>

      <MerchantAttachModal
        open={merchantOpen}
        onClose={() => setMerchantOpen(false)}
        merchantOptions={merchantOptions}
        title={`Enseigne pour ${count} transaction${count > 1 ? "s" : ""}`}
        onAttach={(option) => handlers.onBulkAttachMerchant(selectedKeys, option)}
      />

      <PurchaseAttachModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        purchaseOptions={purchaseOptions}
        simple
        title={`Achat pour ${count} transaction${count > 1 ? "s" : ""}`}
        onAttach={(option) => handlers.onBulkAttachPurchase(selectedKeys, option)}
      />
    </>
  );
}
