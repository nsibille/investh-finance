import { normalizeLabel } from "@/lib/import/dedup";

export interface PatternLike {
  account_id: string | null;
  expected_amount: number | null;
  /** Montants attendus multiples (le prix d'un abonnement peut changer). */
  expected_amounts?: number[] | null;
  amount_tolerance: number; // percent
  frequency_days: number;
  label_pattern: string | null;
  last_seen_at: string | null;
  alert_if_missing: boolean;
}

export interface MatchableTx {
  account_id: string;
  raw_label: string;
  amount: number;
  operation_date: string;
}

/** Whether a transaction plausibly belongs to a recurring pattern. */
export function matchesPattern(pattern: PatternLike, tx: MatchableTx): boolean {
  if (pattern.account_id && pattern.account_id !== tx.account_id) return false;

  const amounts =
    pattern.expected_amounts && pattern.expected_amounts.length > 0
      ? pattern.expected_amounts
      : pattern.expected_amount != null
        ? [pattern.expected_amount]
        : [];
  if (amounts.length > 0) {
    const txAbs = Math.abs(tx.amount);
    const ok = amounts.some((exp) => {
      const e = Math.abs(exp);
      const tol = (e * pattern.amount_tolerance) / 100;
      return Math.abs(txAbs - e) <= Math.max(tol, 0.01);
    });
    if (!ok) return false;
  }

  const patterns = labelPatterns(pattern.label_pattern);
  if (patterns.length > 0) {
    const hay = normalizeLabel(tx.raw_label);
    if (!patterns.some((p) => hay.includes(normalizeLabel(p)))) return false;
  }

  return true;
}

/**
 * Motifs de libellé d'un modèle (un par ligne). Une transaction matche si l'un
 * des motifs est présent dans son libellé.
 */
export function labelPatterns(labelPattern: string | null): string[] {
  return (labelPattern ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Transaction scannée pour l'état d'un modèle : ajoute le rattachement éventuel. */
export interface ScannedTx extends MatchableTx {
  recurring_pattern_id?: string | null;
}

/**
 * Dernière occurrence effective d'un modèle : la date d'opération la plus récente
 * parmi les transactions déjà rattachées au modèle OU qui le matchent (libellé +
 * montant), quel que soit leur statut de validation (les ignorées sont exclues en
 * amont). `floor` = `last_seen_at` persisté du modèle, utilisé comme plancher.
 *
 * On compte aussi les transactions non validées (« Nouvelle ») : une occurrence
 * importée mais pas encore validée reste une occurrence — l'ignorer faisait
 * apparaître le modèle « Manquante » alors que le prélèvement a bien eu lieu.
 */
export function effectiveLastSeen(
  pattern: PatternLike,
  patternId: string,
  txs: ScannedTx[],
  floor: string | null,
): string | null {
  let latest = floor;
  for (const tx of txs) {
    const linked =
      tx.recurring_pattern_id != null && tx.recurring_pattern_id === patternId;
    if (!linked && !matchesPattern(pattern, tx)) continue;
    if (!latest || tx.operation_date > latest) latest = tx.operation_date;
  }
  return latest;
}

export type PatternStatus = "active" | "missing" | "upcoming";

function addDays(date: string, days: number): Date {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * A pattern is "missing" when the next expected occurrence (last seen +
 * frequency) is overdue beyond a grace period.
 */
export function patternStatus(
  pattern: PatternLike,
  lastSeen: string | null,
  today: Date = new Date(),
  graceDays = 7,
): PatternStatus {
  if (!lastSeen) return "active";
  const due = addDays(lastSeen, pattern.frequency_days);
  const overdue = addDays(lastSeen, pattern.frequency_days + graceDays);
  if (pattern.alert_if_missing && today > overdue) return "missing";
  if (today < due) return "upcoming";
  return "active";
}

export function nextExpectedDate(
  lastSeen: string | null,
  frequencyDays: number,
): Date | null {
  return lastSeen ? addDays(lastSeen, frequencyDays) : null;
}
