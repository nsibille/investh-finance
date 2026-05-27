import { normalizeLabel } from "@/lib/import/dedup";

export interface RecurringInput {
  account_id: string;
  raw_label: string;
  amount: number;
  operation_date: string; // YYYY-MM-DD
}

export interface RecurringCandidate {
  account_id: string;
  /** Stable textual key used to match future occurrences. */
  label_pattern: string;
  name: string;
  expected_amount: number;
  frequency_days: number;
  occurrences: number;
  last_seen_at: string;
}

/** Stable grouping key: normalized label with volatile digits removed. */
export function recurringKey(rawLabel: string): string {
  return normalizeLabel(rawLabel)
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 5)
    .join(" ");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000,
  );
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Detects monthly-ish recurring patterns: groups transactions by a digit-free
 * label key + account, keeping groups with >= minOccurrences and a regular
 * (~monthly) interval.
 */
export function detectRecurringCandidates(
  transactions: RecurringInput[],
  { minOccurrences = 3, minInterval = 20, maxInterval = 40 } = {},
): RecurringCandidate[] {
  const groups = new Map<string, RecurringInput[]>();
  for (const tx of transactions) {
    const key = recurringKey(tx.raw_label);
    if (key.length < 3) continue;
    const gk = `${tx.account_id}|${key}`;
    const list = groups.get(gk) ?? [];
    list.push(tx);
    groups.set(gk, list);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [gk, list] of groups) {
    if (list.length < minOccurrences) continue;
    const sorted = [...list].sort((a, b) =>
      a.operation_date.localeCompare(b.operation_date),
    );
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(
        daysBetween(sorted[i - 1].operation_date, sorted[i].operation_date),
      );
    }
    const medInterval = median(intervals);
    if (medInterval < minInterval || medInterval > maxInterval) continue;

    const [account_id, key] = gk.split("|");
    candidates.push({
      account_id,
      label_pattern: key,
      name: titleCase(key),
      expected_amount: median(sorted.map((t) => t.amount)),
      frequency_days: 30,
      occurrences: sorted.length,
      last_seen_at: sorted[sorted.length - 1].operation_date,
    });
  }

  return candidates.sort((a, b) => b.occurrences - a.occurrences);
}
