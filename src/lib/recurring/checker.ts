import { normalizeLabel } from "@/lib/import/dedup";

export interface PatternLike {
  account_id: string | null;
  expected_amount: number | null;
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

  if (pattern.expected_amount != null) {
    const expected = Math.abs(pattern.expected_amount);
    const tol = (expected * pattern.amount_tolerance) / 100;
    if (Math.abs(Math.abs(tx.amount) - expected) > Math.max(tol, 0.01)) {
      return false;
    }
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
