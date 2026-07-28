"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { PurchaseForm } from "./PurchaseForm";
import { InstallmentEditor } from "./InstallmentEditor";
import { PurchaseStatsPanel } from "./PurchaseStatsPanel";
import { getPurchaseEditData } from "@/server/actions/purchases";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type {
  PurchaseParentOption,
  PurchaseWithDetails,
} from "@/lib/purchases/types";

interface EditData {
  initial: {
    name: string;
    description: string | null;
    subcategoryId: string | null;
    merchantId: string | null;
    parentId: string | null;
  };
  purchase: PurchaseWithDetails;
  parentOptions: PurchaseParentOption[];
  attachedTransactionCount: number;
}

/**
 * Modale de détail/édition d'un achat, ouvrable en cliquant le flag « achat »
 * d'une transaction (aperçu d'import ou liste). Réutilise le formulaire d'achat
 * + l'éditeur d'échéancier. Contenu monté à l'ouverture (rechargé à chaque fois).
 */
export function PurchaseEditModal({
  purchaseId,
  onClose,
  subcategoryOptions,
  merchantOptions,
}: {
  /** Id de l'achat à éditer ; `null` ⇒ modale fermée. */
  purchaseId: string | null;
  onClose: () => void;
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
}) {
  return (
    <Modal
      open={purchaseId !== null}
      onClose={onClose}
      title="Détail de l'achat"
      variantClass="modal-entity-detail"
    >
      {purchaseId !== null && (
        <PurchaseEditLoader
          id={purchaseId}
          subcategoryOptions={subcategoryOptions}
          merchantOptions={merchantOptions}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function PurchaseEditLoader({
  id,
  subcategoryOptions,
  merchantOptions,
  onDone,
}: {
  id: string;
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
  onDone: () => void;
}) {
  const [data, setData] = useState<EditData | null>(null);

  useEffect(() => {
    let active = true;
    void getPurchaseEditData(id).then((res) => {
      if (active) setData(res);
    });
    return () => {
      active = false;
    };
  }, [id]);

  // Recharge le contenu (échéancier + stats) sans fermer la modale, après
  // ajout/suppression d'une échéance.
  async function reload() {
    const res = await getPurchaseEditData(id);
    if (res) setData(res);
  }

  if (!data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-6)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="entity-detail-layout">
      <div className="entity-detail-layout__form">
        <PurchaseForm
          mode="edit"
          id={id}
          initial={data.initial}
          subcategoryOptions={subcategoryOptions}
          merchantOptions={merchantOptions}
          parentOptions={data.parentOptions}
          attachedTransactionCount={data.attachedTransactionCount}
          installmentsEditor={
            <InstallmentEditor purchase={data.purchase} onChanged={reload} />
          }
          onDone={onDone}
        />
      </div>
      <div className="entity-detail-layout__stats">
        <PurchaseStatsPanel purchase={data.purchase} />
      </div>
    </div>
  );
}
