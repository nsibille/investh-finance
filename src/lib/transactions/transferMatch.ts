export interface TransferCandidate {
  id: string;
  account_id: string;
  amount: number;
  operation_date: string; // YYYY-MM-DD
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(da - db) / 86_400_000;
}

/**
 * Détecte les virements internes : une sortie (montant < 0) et une entrée
 * (montant opposé) sur DEUX comptes différents, à quelques jours d'écart.
 * Appariement glouton, au plus proche en date. Retourne les paires d'ids.
 */
export function matchInternalTransfers(
  txs: TransferCandidate[],
  windowDays = 4,
): [string, string][] {
  const used = new Set<string>();
  const pairs: [string, string][] = [];

  // Entrées indexées par magnitude (2 décimales).
  const positivesByMagnitude = new Map<string, TransferCandidate[]>();
  for (const t of txs) {
    if (t.amount > 0) {
      const k = t.amount.toFixed(2);
      const list = positivesByMagnitude.get(k);
      if (list) list.push(t);
      else positivesByMagnitude.set(k, [t]);
    }
  }

  const negatives = txs
    .filter((t) => t.amount < 0)
    .sort((a, b) => a.operation_date.localeCompare(b.operation_date));

  for (const neg of negatives) {
    if (used.has(neg.id)) continue;
    const mag = Math.abs(neg.amount).toFixed(2);
    const candidates = (positivesByMagnitude.get(mag) ?? [])
      .filter(
        (p) =>
          !used.has(p.id) &&
          p.account_id !== neg.account_id &&
          daysBetween(neg.operation_date, p.operation_date) <= windowDays,
      )
      .sort(
        (a, b) =>
          daysBetween(neg.operation_date, a.operation_date) -
          daysBetween(neg.operation_date, b.operation_date),
      );

    const match = candidates[0];
    if (!match) continue;
    used.add(neg.id);
    used.add(match.id);
    pairs.push([neg.id, match.id]);
  }

  return pairs;
}
