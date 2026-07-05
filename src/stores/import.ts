import { create } from "zustand";
import type { ParsedTransaction } from "@/lib/import/types";
import type { DuplicateReason, ConnectionSummary } from "@/lib/import/preview";

export interface ImportPreviewRow extends ParsedTransaction {
  duplicate: boolean;
  duplicateReason: DuplicateReason;
  connectionLabel?: string;
  targetAccountExists?: boolean;
  /** Catégorie proposée par les règles (référence pour décider d'un override). */
  suggestedSubcategoryId?: string | null;
  /** Catégorie initiale effective (virement interne détecté sinon règle). */
  initialSubcategoryId?: string | null;
  /** Catégorie courante (proposée par les règles, éventuellement modifiée). */
  categoryId: string | null;
  /** Achat rattaché (la catégorie devient héritée/verrouillée). */
  purchaseId?: string | null;
  purchaseName?: string | null;
  /** Occurrence 1-based de la mensualité (X) et total (Y) — affiché « X/Y ». */
  purchaseOccurrence?: number | null;
  purchaseInstallmentTotal?: number | null;
  /** Abonnement sans fin : total inconnu (occurrence X/∞). */
  purchaseEndless?: boolean;
  /** Échéance non appariée choisie à remplir à l'import (adopte le montant réel). */
  installmentId?: string | null;
  /** Créer une nouvelle échéance dans l'achat à l'import (mois + montant réel). */
  installmentCreate?: boolean;
  /** Enseigne rattachée (règle, achat ou choix manuel). */
  merchantId?: string | null;
  merchantName?: string | null;
  /** Enseigne imposée par l'achat rattaché (non éditable). */
  merchantLocked?: boolean;
  /** Modèle récurrent détecté / rattaché (opération récurrente). */
  recurringId?: string | null;
  recurringName?: string | null;
  include: boolean;
}

export interface ImportPreview {
  bank: string;
  bankLabel: string;
  sourceFormat: string;
  warning: string | null;
  multiAccount: boolean;
  connections: ConnectionSummary[];
  rows: ImportPreviewRow[];
  filename: string;
  dupExisting: number;
}

interface ImportState {
  preview: ImportPreview | null;
  setPreview: (preview: ImportPreview | null) => void;
  patchRow: (index: number, patch: Partial<ImportPreviewRow>) => void;
  clear: () => void;
}

/**
 * Conserve l'aperçu d'import en mémoire pour survivre à la navigation :
 * revenir sur /import restaure le fichier analysé au lieu de tout refaire.
 * (Persiste tant que l'onglet reste ouvert ; un rechargement complet le vide.)
 */
export const useImportStore = create<ImportState>((set) => ({
  preview: null,
  setPreview: (preview) => set({ preview }),
  patchRow: (index, patch) =>
    set((s) =>
      s.preview
        ? {
            preview: {
              ...s.preview,
              rows: s.preview.rows.map((r, i) =>
                i === index ? { ...r, ...patch } : r,
              ),
            },
          }
        : {},
    ),
  clear: () => set({ preview: null }),
}));
