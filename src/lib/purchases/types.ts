import type { Database } from "@/types/database.types";

export type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
export type PurchaseInstallment =
  Database["public"]["Tables"]["purchase_installments"]["Row"];

export interface PurchaseWithDetails extends Purchase {
  categoryLabel: string | null;
  categoryColor: string | null;
  /** Nombre de transactions rattachées. */
  transactionCount: number;
  /** Somme des transactions rattachées (réalisé). */
  paidAmount: number;
  installments: PurchaseInstallment[];
  /** Somme des mensualités prévisionnelles. */
  forecastAmount: number;
  /** Nombre de mensualités déjà appariées à une transaction. */
  matchedInstallments: number;
  /** Achat soldé : toutes les mensualités appariées (ou direct avec ≥1 tx). */
  isFullyPaid: boolean;
  /** Reste à payer (somme des mensualités non appariées). */
  remaining: number;
}

/** Mensualité prévisionnelle non appariée (« transaction non matchée » d'un achat). */
export interface UnmatchedInstallment {
  id: string;
  month: string; // YYYY-MM-01
  amount: number;
}

export interface PurchaseOption {
  id: string;
  name: string;
  subcategoryId: string | null;
  /** Enseigne de l'achat (imposée à la transaction rattachée). */
  merchantId: string | null;
  merchantName: string | null;
  /** Mois des mensualités (triés) — sert à calculer l'occurrence X/Y. */
  installmentMonths: string[];
  /** Échéances non appariées : au rattachement, on peut en remplir une. */
  unmatchedInstallments: UnmatchedInstallment[];
  /** Abonnement sans fin : total inconnu (occurrence X/∞). */
  endless: boolean;
}

/**
 * Choix d'appariement au rattachement d'une transaction à un achat :
 * - `existing` : remplir une échéance prévisionnelle non appariée (elle adopte
 *   le montant réel de la transaction) ;
 * - `create` : créer une nouvelle échéance (mois + montant de l'opération) ;
 * - `auto` : rattachement simple + appariement automatique (comportement d'avant).
 */
export type InstallmentChoice =
  | { mode: "existing"; installmentId: string; month: string; amount: number }
  | { mode: "create" }
  | { mode: "auto" };
