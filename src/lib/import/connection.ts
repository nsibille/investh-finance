/** Libellé de connexion par défaut quand la colonne est vide. */
export const DEFAULT_CONNECTION_LABEL = "Compte importé";

/** Libellé affiché d'une connexion (valeur brute, ou défaut si vide). */
export function connectionLabel(name: string | null | undefined): string {
  return (name ?? "").trim() || DEFAULT_CONNECTION_LABEL;
}

/** Clé normalisée pour rapprocher une connexion d'un compte (casse/espaces ignorés). */
export function normalizeConnection(name: string | null | undefined): string {
  return connectionLabel(name).toLowerCase();
}
