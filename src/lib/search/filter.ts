/**
 * Recherche textuelle locale (filtres de liste : enseignes, achats,
 * récurrences, catégories). Insensible à la casse et aux accents, multi-tokens :
 * chaque mot de la requête doit apparaître dans l'un des champs fournis.
 */

/** Minuscule + suppression des accents (NFD) pour une comparaison tolérante. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Découpe une requête en tokens normalisés (mots séparés par des espaces). */
export function queryTokens(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

/**
 * `true` si chaque token de la requête est présent dans au moins un des champs
 * (les champs sont concaténés, la correspondance se fait sur la botte de foin
 * complète). Une requête vide matche toujours.
 */
export function matchesQuery(
  query: string,
  fields: Array<string | null | undefined>,
): boolean {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeText(fields.filter(Boolean).join(" "));
  return tokens.every((t) => haystack.includes(t));
}
