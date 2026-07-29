import { normalizeText } from "@/lib/search/filter";
import type { CategoryDisplay } from "./types";

/** Nom (normalisé) de la catégorie des virements internes. */
const INTERNAL_CATEGORY = "virement interne";

/**
 * Sous-catégorie(s) « Virement interne » depuis la map d'affichage (dérivée de
 * l'arbre des catégories, donc sans requête supplémentaire).
 */
export function internalTransferSubIds(
  categories: Map<string, CategoryDisplay>,
): Set<string> {
  const ids = new Set<string>();
  for (const [subId, d] of categories)
    if (normalizeText(d.categoryName) === INTERNAL_CATEGORY) ids.add(subId);
  return ids;
}

/**
 * Vrai si la transaction est un virement interne **relié** (apparié à sa
 * contrepartie via `transfer_group_id`). Ces opérations ne font que déplacer de
 * l'argent entre tes comptes : elles doivent être neutralisées PARTOUT dans les
 * agrégats (stats de catégories, trésorerie, patrimoine…). Les virements
 * internes **orphelins** (non appariés) restent comptés, pour rester visibles
 * et être réconciliés.
 */
export function isLinkedInternalTransfer(
  row: { subcategory_id: string | null; transfer_group_id: string | null },
  internalSubIds: Set<string>,
): boolean {
  return (
    row.subcategory_id != null &&
    internalSubIds.has(row.subcategory_id) &&
    row.transfer_group_id != null
  );
}
