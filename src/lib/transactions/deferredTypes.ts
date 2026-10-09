// Types & constantes de la réconciliation des débits différés, sans dépendance
// serveur : importables depuis un composant client.

/** En deçà de cet écart (€), le mois est considéré comme concordant. */
export const DEFERRED_TOLERANCE = 0.01;

export interface DeferredLine {
  id: string;
  operation_date: string;
  label: string;
  amount: number;
}

export type DeferredMonthStatus = "ok" | "gap" | "missing" | "open";

export interface DeferredMonth {
  /** YYYY-MM */
  month: string;
  /** Prélèvement(s) « DEBIT DIFFERE » rattachés au mois. */
  debits: DeferredLine[];
  /** Paiements carte du mois (remboursements inclus). */
  ops: DeferredLine[];
  debitTotal: number;
  opsTotal: number;
  /** opsTotal − debitTotal : > 0 = prélevé plus que les paiements connus. */
  gap: number;
  status: DeferredMonthStatus;
}

export interface DeferredAccountReconciliation {
  account: { id: string; name: string; color: string | null };
  currency: string;
  months: DeferredMonth[];
  /** Somme des paiements carte sur la période réconciliée. */
  opsTotal: number;
  /** Somme des prélèvements. */
  debitTotal: number;
  /** Paiements du mois en cours, pas encore prélevés. */
  pending: number;
  /** Écart cumulé des mois clos (paiements − prélèvements). */
  gapTotal: number;
  /** Paiements des mois clos sans prélèvement correspondant. */
  missingTotal: number;
  /** Paiements antérieurs au 1er prélèvement connu (hors réconciliation). */
  before: { count: number; total: number };
}

export interface DeferredReconciliation {
  accounts: DeferredAccountReconciliation[];
}
