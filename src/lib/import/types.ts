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
   * Enseigne rattachée dans l'aperçu (règle, achat ou choix manuel). Présente ⇒
   * fait foi ; absente ⇒ le moteur de règles décide.
   */
  merchant_id?: string | null;
}

export interface ImportSummary {
  import_id: string;
  rows_total: number;
  rows_imported: number;
  rows_duplicates: number;
  rows_auto_validated: number;
}
