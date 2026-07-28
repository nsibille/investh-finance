"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { MerchantForm, type MerchantFormInitial } from "./MerchantForm";
import { MerchantStatsPanel } from "./MerchantStatsPanel";
import { getMerchantEditInitial, getMerchantQuickStats } from "@/server/actions/merchants";
import type { MerchantStats } from "@/lib/merchants/stats";
import type { SubcategoryOption } from "@/lib/categories/types";

/**
 * Modale de détail d'une enseigne : formulaire d'édition à gauche, panneau de
 * statistiques (KPIs, fun facts, graphe 12 mois, catégories) à droite. La modale
 * s'élargit pour accueillir le panneau ; le contenu n'est monté qu'à l'ouverture
 * (données rechargées à chaque fois).
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
    <Modal
      open={merchantId !== null}
      onClose={onClose}
      title="Détail de l'enseigne"
      variantClass="modal-merchant-detail"
    >
      {merchantId !== null && (
        <MerchantDetailLoader
          id={merchantId}
          subcategoryOptions={subcategoryOptions}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function MerchantDetailLoader({
  id,
  subcategoryOptions,
  onDone,
}: {
  id: string;
  subcategoryOptions: SubcategoryOption[];
  onDone: () => void;
}) {
  const [initial, setInitial] = useState<MerchantFormInitial | null>(null);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getMerchantEditInitial(id).then((d) => {
      if (active) setInitial(d);
    });
    void getMerchantQuickStats(id)
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
    <div className="merchant-detail-layout">
      <div className="merchant-detail-layout__form">
        {!initial ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-6)" }}>
            <Spinner size="lg" />
          </div>
        ) : (
          <MerchantForm
            mode="edit"
            id={id}
            initial={initial}
            subcategoryOptions={subcategoryOptions}
            onDone={onDone}
          />
        )}
      </div>

      <div className="merchant-detail-layout__stats">
        {!statsLoaded ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <SkeletonBlock height={72} />
            <SkeletonBlock height={120} />
            <SkeletonBlock height={200} />
          </div>
        ) : stats ? (
          <MerchantStatsPanel stats={stats} />
        ) : (
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            Statistiques indisponibles.
          </p>
        )}
      </div>
    </div>
  );
}
