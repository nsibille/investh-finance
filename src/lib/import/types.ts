import type { Database } from "@/types/database.types";

/** Source-agnostic parsed transaction (from CSV, API, etc.). */
export interface ParsedTransaction {
  /** ISO date YYYY-MM-DD of the operation. */
  operation_date: string;
  /** ISO date YYYY-MM-DD, optional value date. */
  value_date?: string | null;
  /** Human-friendly label shown in the UI. */
  label: string;
  /** Raw bank label, used for rule matching and dedup. */
  raw_label: string;
  /** Signed amount: negative = debit, positive = credit. */
  amount: number;
  currency: string;
  /** Stable external id from the source (bank transactionId), when available. */
  external_id?: string | null;
  /**
   * Nom de la connexion bancaire (export CSV) : sert de pivot pour
   * rattacher/créer automatiquement le compte de destination.
   */
  connection_name?: string | null;
  /**
   * Catégorie choisie/validée dans l'aperçu d'import. Présente ⇒ l'utilisateur
   * a revu la proposition des règles (override) ; absente ⇒ les règles décident.
   */
  subcategory_id?: string | null;
  /** Achat rattaché lors de l'import (la catégorie de l'achat prime). */
  purchase_id?: string | null;
  /**
   * Échéance prévisionnelle de l'achat à remplir avec cette transaction (choix
   * « transaction non matchée »). Appariée après l'insertion (adopte le montant
   * réel). Ignorée si la ligne est un doublon non importé.
   */
  installment_id?: string | null;
  /**
   * Créer une nouvelle échéance dans l'achat (mois + montant de l'opération) et
   * l'apparier à cette transaction. Exclusif de `installment_id`.
   */
  installment_create?: boolean;
  /**
   * Enseigne rattachée dans l'aperçu (règle, achat ou choix manuel). Présente ⇒
   * fait foi ; absente ⇒ le moteur de règles décide.
   */
  merchant_id?: string | null;
  /**
   * Ventilation entre personnes choisie dans l'aperçu : nature globale
   * (dette/cadeau) + personnes concernées. Le montant est réparti à parts
   * égales à l'import (ajustable ensuite à l'édition de la transaction).
   */
  persons?: {
    nature: Database["public"]["Enums"]["split_nature"];
    personIds: string[];
  } | null;
  /** Note libre saisie dans l'aperçu d'import (annotation directe). */
  note?: string | null;
  /**
   * Force l'import d'une ligne détectée comme doublon déjà en base (déflaguée
   * manuellement dans l'aperçu quand la détection est un faux positif) : le
   * pipeline lui attribue la première occurrence libre pour contourner la
   * contrainte d'unicité `(account_id, dedup_hash)` au lieu de l'ignorer.
   */
  force?: boolean;
}

export interface ImportSummary {
  import_id: string;
  rows_total: number;
  rows_imported: number;
  rows_duplicates: number;
  rows_auto_validated: number;
}
