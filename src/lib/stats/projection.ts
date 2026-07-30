import type { EntityProjection } from "./entity";

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pct(cur: number, prev: number): number | null {
  return prev <= 0.005 ? null : ((cur - prev) / prev) * 100;
}

/**
 * Projection d'une entité à partir de sa série mensuelle (flux principal, 12
 * valeurs, la dernière = mois en cours). Robuste par construction :
 *
 * - **On exclut le mois en cours** (dernier index) : incomplet, il fausserait
 *   l'estimation court terme et la tendance (ex. un salaire pas encore versé).
 * - On ne considère que les mois **actifs** (montant > 0) → pas de trou.
 * - `runRate` / `year` = moyenne des mois complets actifs × 12 (annuel incluant
 *   les primes ponctuelles au prorata).
 * - `nextMonth` = **médiane** des 3 derniers mois complets (résiste aux primes,
 *   reflète un mois « typique »).
 * - `trendPct` = médiane des 3 derniers vs médiane des 3 précédents (idem).
 *
 * `null` si moins de 2 mois complets actifs (donnée insuffisante).
 */
export function computeProjection(monthAmount: number[]): EntityProjection | null {
  // Mois complets = tous sauf le dernier (mois de référence, en cours).
  const completed = monthAmount.slice(0, Math.max(0, monthAmount.length - 1));
  const active = completed.filter((v) => v > 0.005);
  if (active.length < 2) return null;

  const runRate = active.reduce((s, v) => s + v, 0) / active.length;
  const last3 = active.slice(-3);
  const prev3 = active.slice(-6, -3);

  return {
    runRate,
    nextMonth: median(last3),
    year: runRate * 12,
    trendPct: prev3.length >= 2 ? pct(median(last3), median(prev3)) : null,
  };
}
