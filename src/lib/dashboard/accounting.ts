/**
 * Rattachement mensuel des transactions ("date de valeur métier").
 *
 * Un revenu perçu en toute fin de mois correspond, dans le budget vécu, au mois
 * suivant : le salaire viré le 27 mars finance avril. Pour que le dashboard
 * reflète ce ressenti, on rattache les revenus de fin de mois au 1er du mois
 * suivant. Les dépenses — et les revenus de début/milieu de mois — restent sur
 * leur mois d'opération.
 *
 * La règle est volontairement pure et déterministe (aucune dépendance date-fns,
 * calcul sur la chaîne ISO) pour rester testable et cohérente entre les
 * différents agrégats du dashboard.
 */

/** Jour du mois (inclus) à partir duquel un revenu bascule sur le mois suivant. */
export const INCOME_SHIFT_DAY = 25;

/**
 * Date de rattachement (`YYYY-MM-DD`) d'une transaction pour l'agrégation
 * mensuelle.
 * - Revenu (`isIncome`) daté au seuil ou au-delà → 1er du mois suivant.
 * - Sinon → date d'opération inchangée.
 */
export function accountingDate(operationDate: string, isIncome: boolean): string {
  if (!isIncome) return operationDate;
  const day = Number(operationDate.slice(8, 10));
  if (day < INCOME_SHIFT_DAY) return operationDate;

  const year = Number(operationDate.slice(0, 4));
  const month = Number(operationDate.slice(5, 7)); // 1-12
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/** Mois de rattachement (`YYYY-MM`) d'une transaction. */
export function accountingMonth(operationDate: string, isIncome: boolean): string {
  return accountingDate(operationDate, isIncome).slice(0, 7);
}
