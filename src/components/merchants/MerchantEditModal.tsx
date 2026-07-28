"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { MerchantForm, type MerchantFormInitial } from "./MerchantForm";
import { getMerchantEditInitial } from "@/server/actions/merchants";
import type { SubcategoryOption } from "@/lib/categories/types";

/**
 * Modale d'édition d'une enseigne, ouvrable en cliquant le flag « enseigne »
 * d'une transaction (aperçu d'import ou liste). Le contenu (chargement + form)
 * n'est monté qu'à l'ouverture : les données sont rechargées à chaque ouverture.
 */
export function MerchantEditModal({
  merchantId,
  onClose,
  subcategoryOptions,
}: {
  /** Id de l'enseigne à éditer ; `null` ⇒ modale fermée. */
  merchantId: string | null;
  onClose: () => void;
  subcategoryOptions: SubcategoryOption[];
}) {
  return (
    <Modal open={merchantId !== null} onClose={onClose} title="Modifier l'enseigne">
      {merchantId !== null && (
        <MerchantEditLoader
          id={merchantId}
          subcategoryOptions={subcategoryOptions}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function MerchantEditLoader({
  id,
  subcategoryOptions,
  onDone,
}: {
  id: string;
  subcategoryOptions: SubcategoryOption[];
  onDone: () => void;
}) {
  const [initial, setInitial] = useState<MerchantFormInitial | null>(null);

  useEffect(() => {
    let active = true;
    void getMerchantEditInitial(id).then((data) => {
      if (active) setInitial(data);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (!initial) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-6)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <MerchantForm
      mode="edit"
      id={id}
      initial={initial}
      subcategoryOptions={subcategoryOptions}
      onDone={onDone}
    />
  );
}
