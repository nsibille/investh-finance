import type { Database } from "@/types/database.types";

export type Person = Database["public"]["Tables"]["persons"]["Row"];
export type PersonRepayment =
  Database["public"]["Tables"]["person_repayments"]["Row"];
export type PersonManualEntry =
  Database["public"]["Tables"]["person_manual_entries"]["Row"];
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
  currency: string;
  shareAmount: number; // part de la personne (positif)
  nature: SplitNature;
}

/**
 * Direction d'une part « dette », déduite du signe de la transaction :
 * - `owed_to_me` : dépense avancée (montant < 0) → la personne me doit.
 * - `i_owe` : virement pro reçu (montant > 0) → je dois à la personne.
 */
export type DebtDirection = "owed_to_me" | "i_owe";

export function debtDirection(txAmount: number): DebtDirection {
  return txAmount > 0 ? "i_owe" : "owed_to_me";
}

/** Remboursement bancaire déjà lié à une transaction (rattaché à une personne). */
export interface TransactionRepaymentInfo {
  id: string;
  personId: string;
  amount: number;
  repaidOn: string;
  note: string | null;
}

/**
 * Contexte de remboursement d'une transaction pour l'éditeur de lien :
 * date d'opération (défaut du `repaidOn`) + éventuel remboursement déjà lié.
 */
export interface TransactionRepaymentContext {
  operationDate: string | null;
  repayment: TransactionRepaymentInfo | null;
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

/** Dette / cadeau « manuel » d'une personne (sans ligne bancaire). */
export interface PersonManualEntryRow {
  id: string;
  nature: SplitNature;
  amount: number;
  entryDate: string;
  label: string | null;
  note: string | null;
}

/**
 * Événement unifié du registre d'une personne pour la page de détail :
 * part d'une transaction ventilée, dette/cadeau manuel, ou remboursement.
 */
export type PersonEvent =
  | {
      kind: "share";
      id: string;
      date: string;
      nature: SplitNature;
      amount: number;
      /** Direction (dette uniquement) : la personne me doit / je lui dois. */
      direction: DebtDirection;
      transactionId: string;
      label: string;
    }
  | {
      kind: "manual";
      id: string;
      date: string;
      nature: SplitNature;
      amount: number;
      label: string | null;
      note: string | null;
    }
  | {
      kind: "repayment";
      id: string;
      date: string;
      amount: number;
      note: string | null;
      transactionId: string | null;
      label: string | null;
    };

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
  /** Argent que JE dois à la personne (virements pro reçus). */
  iOwe: number;
  /** Solde net signé : > 0 la personne me doit, < 0 je lui dois. */
  netBalance: number;
  shares: PersonShareRow[];
  repayments: PersonRepaymentRow[];
  manualEntries: PersonManualEntryRow[];
}
