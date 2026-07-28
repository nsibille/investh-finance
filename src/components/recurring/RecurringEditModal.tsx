"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { RecurringForm } from "./RecurringForm";
import { getRecurringEditData } from "@/server/actions/recurring";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringInput } from "@/lib/recurring/schema";

/**
 * Modale d'édition d'une récurrente, ouvrable en cliquant le flag « récurrence »
 * d'une transaction (aperçu d'import ou liste). Le contenu n'est monté qu'à
 * l'ouverture (rechargé à chaque fois). Le changement d'enseigne/catégorie se
 * répercute côté serveur sur les transactions rattachées (champs vides).
 */
export function RecurringEditModal({
  recurringId,
  onClose,
  subcategoryOptions,
  merchantOptions,
}: {
  /** Id de la récurrente à éditer ; `null` ⇒ modale fermée. */
  recurringId: string | null;
  onClose: () => void;
  subcategoryOptions: SubcategoryOption[];
  merchantOptions: MerchantOption[];
}) {
  return (
    <Modal open={recurringId !== null} onClose={onClose} title="Modifier la récurrente">
      {recurringId !== null && (
        <RecurringEditLoader
          id={recurringId}
          subcategoryOptions={subcategoryOptions}
          merchantOptions={merchantOptions}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function RecurringEditLoader({
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
  const [data, setData] = useState<{
    initial: Partial<RecurringInput>;
    accountOptions: AccountOption[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    void getRecurringEditData(id).then((res) => {
      if (active) setData(res);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (!data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-6)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <RecurringForm
      mode="edit"
      id={id}
      initial={data.initial}
      accountOptions={data.accountOptions}
      subcategoryOptions={subcategoryOptions}
      merchantOptions={merchantOptions}
      onDone={onDone}
    />
  );
}
