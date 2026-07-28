"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { RecurringForm } from "./RecurringForm";
import { RecurringStatsPanel } from "./RecurringStatsPanel";
import {
  getRecurringEditData,
  getRecurringStatsAction,
} from "@/server/actions/recurring";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";
import type { MerchantOption } from "@/lib/merchants/types";
import type { RecurringInput } from "@/lib/recurring/schema";
import type { RecurringStats } from "@/lib/recurring/stats";

/**
 * Modale d'édition d'une récurrente : panneau de statistiques (KPIs, fun facts,
 * graphe temporel des versements) à gauche, formulaire d'édition (avec liste de
 * motifs) à droite. Ouvrable depuis la liste des récurrentes ou en cliquant le
 * flag « récurrence » d'une transaction. Le contenu n'est monté qu'à l'ouverture
 * (données rechargées à chaque fois).
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
    <Modal
      open={recurringId !== null}
      onClose={onClose}
      title="Modifier la récurrente"
      variantClass="modal-entity-detail"
    >
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
  const [stats, setStats] = useState<RecurringStats | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getRecurringEditData(id).then((res) => {
      if (active) setData(res);
    });
    void getRecurringStatsAction(id)
      .then((s) => {
        if (active) setStats(s);
      })
      .finally(() => {
        if (active) setStatsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="recurring-detail-layout">
      <div className="recurring-detail-layout__stats">
        {!statsLoaded ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <SkeletonBlock height={72} />
            <SkeletonBlock height={120} />
            <SkeletonBlock height={200} />
          </div>
        ) : stats ? (
          <RecurringStatsPanel stats={stats} />
        ) : (
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            Statistiques indisponibles.
          </p>
        )}
      </div>

      <div>
        {!data ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-6)" }}>
            <Spinner size="lg" />
          </div>
        ) : (
          <RecurringForm
            mode="edit"
            id={id}
            initial={data.initial}
            accountOptions={data.accountOptions}
            subcategoryOptions={subcategoryOptions}
            merchantOptions={merchantOptions}
            onDone={onDone}
          />
        )}
      </div>
    </div>
  );
}
