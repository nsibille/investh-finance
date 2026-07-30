/**
 * Modèle de statistiques d'une « entité » (enseigne ou catégorie), partagé par
 * `getMerchantStats` et `getCategoryDetailStats` et rendu par un seul et même
 * composant (`EntityStatsView`). Tout ce qui distingue une enseigne d'une
 * catégorie est porté par la donnée (libellés, parents, navigation), jamais par
 * le composant — d'où des écrans strictement identiques.
 */

export interface EntityMonthlyPoint {
  month: string; // "YYYY-MM"
  label: string; // « janv. »
  year: number;
  amount: number; // flux principal du mois (positif)
  count: number; // nb d'opérations du flux principal ce mois
}

/** Point journalier (vue zoomée sur un mois) pour le look-through. */
export interface EntityDailyPoint {
  date: string; // "YYYY-MM-DD"
  day: number; // 1..31
  amount: number;
  count: number;
}

/** Transaction condensée pour la liste look-through de la portée. */
export interface EntityTxn {
  id: string;
  date: string; // "YYYY-MM-DD"
  label: string;
  amount: number; // signé
  categoryLabel: string | null;
  categoryColor: string | null;
}

/** Tranche de répartition (par catégorie pour une enseigne, par sous-cat. pour une catégorie). */
export interface EntitySlice {
  key: string;
  label: string;
  color: string | null;
  amount: number; // flux principal cumulé (positif)
  count: number;
}

/** Poids de l'entité dans un de ses parents (catégorie, type…) sur la fenêtre. */
export interface EntityWeight {
  scope: string; // « Catégorie », « Type »
  label: string;
  color: string | null;
  pct: number;
  total: number;
}

/** Série mensuelle CUMULÉE d'un parent (inclut l'entité), pour la ventilation. */
export interface EntityParentSeries {
  scope: string; // « Catégorie », « Type »
  label: string;
  monthly: number[]; // 12 valeurs, flux principal
}

/** Projection simple basée sur l'année glissante (mois actifs). */
export interface EntityProjection {
  runRate: number;
  nextMonth: number;
  year: number;
  trendPct: number | null;
}

export interface EntityStats {
  /** Nature de l'entité : pilote l'icône et quelques libellés du composant. */
  kind: "merchant" | "category";
  id: string;
  name: string;
  /** Sous-titre (catégorie par défaut d'une enseigne, ou type d'une catégorie). */
  categoryLabel: string | null;
  categoryColor: string | null;
  /** Métadonnées propres à l'enseigne (ignorées pour une catégorie). */
  isOnline: boolean;
  country: string | null;
  /** Sens du flux principal : crédits (revenu) ou débits (dépense). */
  isIncome: boolean;

  // Cumuls (toute la période d'activité)
  total: number;
  counterTotal: number;
  netAmount: number;
  transactionCount: number;
  purchaseCount: number;
  firstDate: string | null;
  lastDate: string | null;
  maxFlow: { amount: number; date: string } | null;
  avgMonthly: number;
  basket: number;
  frequency: number;

  // Fenêtre / zoom (année glissante)
  months: string[];
  monthLabels: string[];
  zoomMonth: string | null;
  scopeFrom: string;
  scopeTo: string;
  monthly: EntityMonthlyPoint[];

  // Portée (mois zoomé, sinon 12 mois)
  scopeTotal: number;
  scopeCount: number;
  daily: EntityDailyPoint[] | null;
  scopeTransactions: EntityTxn[];

  // Répartition (enfants directs)
  categories: EntitySlice[]; // toute la période
  scopeCategories: EntitySlice[]; // portée
  /** Nom du niveau enfant, au singulier (« catégorie », « sous-catégorie »). */
  breakdownTitle: string;

  // Parents (poids + ventilation)
  weights: EntityWeight[];
  parents: EntityParentSeries[]; // du plus proche au plus large

  projection: EntityProjection | null;

  // Navigation (mêmes biais pour toutes les entités)
  nav: {
    manageHref: string;
    manageLabel: string;
    /** Query de drill-down vers le listing (ex. `merchant=<id>` ou `category=<id>`). */
    listQuery: string;
  };
}
