import type { Database } from "@/types/database.types";

export type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
export type PurchaseInstallment =
  Database["public"]["Tables"]["purchase_installments"]["Row"];
type TransactionStatus = Database["public"]["Enums"]["transaction_status"];

/** Ligne de transaction rattachée à un achat (lecture seule, type liste). */
export interface PurchaseTxLine {
  id: string;
  operation_date: string;
  label: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  accountName: string | null;
  accountColor: string | null;
}

/**
 * Transaction non rattachée, candidate à l'assignation depuis le détail d'un
 * achat (sélecteur « rattacher / assigner / réassigner une transaction »).
 */
export interface AttachableTransaction {
  id: string;
  operation_date: string;
  label: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  accountName: string | null;
  accountColor: string | null;
}

/** Part d'une personne sur un achat (agrégée sur ses transactions ventilées). */
export interface PurchasePersonShare {
  personId: string;
  name: string;
  color: string;
  isSelf: boolean;
  nature: Database["public"]["Enums"]["split_nature"]; // "debt" | "gift"
  amount: number; // somme des parts (positif)
}

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

  // ----- Groupes (arborescence via parent_id) -----
  /** IDs des enfants directs (achats rattachés à celui-ci). */
  childIds: string[];
  /** Nombre de descendants (enfants + petits-enfants…). Groupe si > 0. */
  descendantCount: number;
  /** Réalisé agrégé sur le sous-arbre (self + descendants). */
  totalPaidAmount: number;
  /** Transactions agrégées sur le sous-arbre. */
  totalTransactionCount: number;
  /** Prévisionnel agrégé sur le sous-arbre. */
  totalForecastAmount: number;
  /** Reste à payer agrégé sur le sous-arbre. */
  totalRemaining: number;

  /** Transactions rattachées (directes), triées récent → ancien. */
  transactions: PurchaseTxLine[];
  /** Nom de l'achat parent éventuel (résolu depuis l'arborescence). */
  parentName: string | null;
  /** Nom de l'enseigne rattachée éventuelle. */
  merchantName: string | null;
  /** Parts des personnes (dette/cadeau) agrégées sur les transactions. */
  persons: PurchasePersonShare[];
  /** Date de la 1re transaction rattachée (plus ancienne) ; null si aucune. */
  firstTransactionDate: string | null;
  /** Soldé automatiquement par un échéancier complet (vs marquage manuel). */
  autoSettled: boolean;
}

/**
 * Détail complet d'un achat pour la page `/achats/[id]` : l'achat + son parent
 * éventuel + ses sous-achats directs (résolus en objets complets).
 */
export interface PurchaseDetail extends PurchaseWithDetails {
  parent: { id: string; name: string } | null;
  children: PurchaseWithDetails[];
}

/** Élément léger pour peupler un sélecteur d'achat parent (groupe). */
export interface PurchaseParentOption {
  id: string;
  name: string;
  parentId: string | null;
  isArchived: boolean;
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
  /**
   * Toutes les échéances (paiements programmés), triées par mois, avec leur état
   * d'appariement — pour afficher le calendrier dans le sélecteur de rattachement
   * (réglée ✓ ou à venir).
   */
  scheduledInstallments: { month: string; amount: number; matched: boolean }[];
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
