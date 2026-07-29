/**
 * Classement d'une catégorie en « segment » budgétaire, socle du dashboard.
 * Pur et déterministe (aucune I/O) pour rester testable et partagé entre les
 * agrégats serveur et les liens de drill-down vers le listing.
 *
 * - `revenus`          : tout type de revenu (`is_income`).
 * - `fixes`            : Frais Fixes + Prélèvements (dépenses récurrentes/subies).
 * - `variables`        : Frais Variables (et toute dépense de type inconnu).
 * - `investissements`  : type « Investissements ».
 * - `null`             : virements internes (exclus) et non catégorisées.
 */
export type Segment = "revenus" | "fixes" | "variables" | "investissements";

/** Slugs des types de catégorie reconnus. */
export const TYPE_SLUG = {
  revenus: "revenus",
  prelevements: "prelevements",
  fraisFixes: "frais-fixes",
  fraisVariables: "frais-variables",
  investissements: "investissements",
  virements: "virements",
} as const;

/** Types de catégorie (slugs) composant chaque segment de dépense/investissement. */
export const SEGMENT_TYPE_SLUGS: Record<
  Exclude<Segment, "revenus">,
  string[]
> = {
  fixes: [TYPE_SLUG.fraisFixes, TYPE_SLUG.prelevements],
  variables: [TYPE_SLUG.fraisVariables],
  investissements: [TYPE_SLUG.investissements],
};

/** Segment d'une catégorie d'après le slug de son type et son caractère revenu. */
export function segmentOf(
  typeSlug: string | null | undefined,
  isIncome: boolean,
): Segment | null {
  if (isIncome) return "revenus";
  switch (typeSlug) {
    case TYPE_SLUG.investissements:
      return "investissements";
    case TYPE_SLUG.fraisVariables:
      return "variables";
    case TYPE_SLUG.fraisFixes:
    case TYPE_SLUG.prelevements:
      return "fixes";
    case TYPE_SLUG.virements:
      return null;
    default:
      // Dépense d'un type inconnu (ex. « Importées ») : rangée en variable.
      return "variables";
  }
}

/** Libellé d'affichage d'un segment. */
export const SEGMENT_LABEL: Record<Segment, string> = {
  revenus: "Revenus",
  fixes: "Dépenses fixes",
  variables: "Dépenses variables",
  investissements: "Investissements",
};
