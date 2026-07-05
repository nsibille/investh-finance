import type { Database } from "@/types/database.types";

export type Person = Database["public"]["Tables"]["persons"]["Row"];
export type PersonRepayment =
  Database["public"]["Tables"]["person_repayments"]["Row"];
export type SplitNature = Database["public"]["Enums"]["split_nature"];

/** Option légère (id, nom, moi ?, couleur) pour le sélecteur de personnes. */
export interface PersonOption {
  id: string;
  name: string;
  isSelf: boolean;
  color: string;
}

/** Part d'une personne sur une transaction (montant absolu positif). */
export interface TransactionShare {
  personId: string;
  name: string;
  isSelf: boolean;
  color: string;
  amount: number;
}

/** Ventilation complète d'une transaction : nature globale + parts. */
export interface TransactionSplit {
  nature: SplitNature | null;
  shares: TransactionShare[];
}

/** Une part contribuant au solde d'une personne (avec la transaction source). */
export interface PersonShareRow {
  transactionId: string;
  label: string;
  operationDate: string;
  amount: number; // montant de la transaction (signé)
  shareAmount: number; // part de la personne (positif)
  nature: SplitNature;
}

/** Remboursement enrichi du libellé de la transaction liée éventuelle. */
export interface PersonRepaymentRow {
  id: string;
  amount: number;
  repaidOn: string;
  note: string | null;
  transactionId: string | null;
  transactionLabel: string | null;
}

/**
 * Personne + soldes agrégés (vue `person_balances`) + détail du registre
 * (parts dette/cadeau + remboursements) pour la page « Personnes ».
 */
export interface PersonLedger {
  id: string;
  name: string;
  isSelf: boolean;
  color: string;
  isArchived: boolean;
  totalDebt: number;
  totalGift: number;
  totalRepaid: number;
  outstandingDebt: number;
  shares: PersonShareRow[];
  repayments: PersonRepaymentRow[];
}
