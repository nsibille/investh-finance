/**
 * Compatibilité d'enseigne pour l'appariement automatique (récurrence, achat).
 *
 * L'enseigne d'une transaction fait autorité : on n'apparie automatiquement une
 * récurrente ou un achat que s'ils ne CONTREDISENT pas cette enseigne. On bloque
 * uniquement en cas de contradiction avérée : la transaction a une enseigne,
 * l'entité en a au moins une (dans son historique), et celle de la transaction
 * n'y figure pas.
 *
 * - Transaction sans enseigne ⇒ toujours compatible (l'entité pourra la remplir).
 * - Entité sans enseigne connue (`acceptable` vide) ⇒ agnostique, compatible.
 *
 * @param txMerchantId  Enseigne déjà résolue de la transaction (règles), ou null.
 * @param acceptable    Enseignes acceptables de l'entité : pour une récurrente,
 *   son enseigne ; pour un achat, son enseigne + celles de ses transactions déjà
 *   rattachées (historique).
 */
export function merchantCompatible(
  txMerchantId: string | null | undefined,
  acceptable: Set<string>,
): boolean {
  if (!txMerchantId) return true;
  if (acceptable.size === 0) return true;
  return acceptable.has(txMerchantId);
}

/** Ensemble acceptable pour une récurrente (son enseigne éventuelle). */
export function recurringAcceptableMerchants(
  merchantId: string | null | undefined,
): Set<string> {
  return merchantId ? new Set([merchantId]) : new Set();
}
