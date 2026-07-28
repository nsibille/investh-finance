import { createClient } from "@/lib/supabase/server";
import {
  getAccountDisplayMap,
  getCategoryDisplayMap,
} from "@/lib/transactions/queries";
import { nextExpectedDate } from "./checker";

/** Un versement rattaché (transaction liée à la récurrence), plus ancien → récent. */
export interface RecurringOccurrence {
  date: string; // YYYY-MM-DD
  amount: number; // valeur absolue (montant payé)
}

export interface RecurringStats {
  id: string;
  name: string;
  categoryLabel: string | null;
  categoryColor: string | null;
  merchantName: string | null;
  accountName: string | null;
  frequencyDays: number;
  expectedAmount: number | null;
  /** Nombre de versements rattachés. */
  occurrenceCount: number;
  /** Cumul payé (somme des montants, valeur absolue). */
  totalAmount: number;
  /** Versement moyen. */
  avgAmount: number;
  /** Plus petit / plus gros versement. */
  minAmount: number | null;
  maxAmount: number | null;
  firstDate: string | null;
  lastDate: string | null;
  nextExpected: string | null;
  /** Coût annualisé estimé au rythme de la fréquence (moyenne × occurrences/an). */
  annualized: number;
  /** Série chronologique des derniers versements (≤ 12), pour le graphe temporel. */
  occurrences: RecurringOccurrence[];
}

/**
 * Statistiques d'une récurrence pour le panneau de la modale d'édition : cumul
 * payé, versement moyen, coût annualisé, prochaine échéance et série temporelle
 * des derniers versements. Source : les transactions rattachées à la récurrence
 * (`recurring_pattern_id`), hors ignorées.
 */
export async function getRecurringStats(
  id: string,
): Promise<RecurringStats | null> {
  const supabase = await createClient();
  const [{ data: pattern }, { data: txs }, accounts, categories] =
    await Promise.all([
      supabase
        .from("recurring_patterns")
        .select(
          "id, name, subcategory_id, merchant_id, account_id, frequency_days, expected_amount, last_seen_at, merchant:merchants(name)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("amount, operation_date")
        .eq("recurring_pattern_id", id)
        .neq("status", "ignored")
        .order("operation_date", { ascending: true }),
      getAccountDisplayMap(),
      getCategoryDisplayMap(),
    ]);

  if (!pattern) return null;

  const rows = (txs ?? []) as { amount: number; operation_date: string }[];

  let totalAmount = 0;
  let minAmount: number | null = null;
  let maxAmount: number | null = null;
  const occurrences: RecurringOccurrence[] = [];
  for (const t of rows) {
    const amount = Math.abs(Number(t.amount));
    totalAmount += amount;
    minAmount = minAmount == null ? amount : Math.min(minAmount, amount);
    maxAmount = maxAmount == null ? amount : Math.max(maxAmount, amount);
    occurrences.push({ date: t.operation_date, amount });
  }

  const occurrenceCount = rows.length;
  const avgAmount = occurrenceCount > 0 ? totalAmount / occurrenceCount : 0;
  const firstDate = rows[0]?.operation_date ?? null;
  const lastDate = rows[occurrenceCount - 1]?.operation_date ?? null;

  const lastSeen = lastDate ?? pattern.last_seen_at ?? null;
  const next = nextExpectedDate(lastSeen, pattern.frequency_days);
  const nextExpected = next
    ? `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`
    : null;

  const cat = pattern.subcategory_id
    ? categories.get(pattern.subcategory_id)
    : undefined;
  const merchant = pattern.merchant as { name: string } | { name: string }[] | null;
  const merchantName = Array.isArray(merchant)
    ? (merchant[0]?.name ?? null)
    : (merchant?.name ?? null);

  // Coût annualisé : versement moyen × nombre d'occurrences par an.
  const perYear = pattern.frequency_days > 0 ? 365 / pattern.frequency_days : 0;
  const annualized = avgAmount * perYear;

  return {
    id: pattern.id,
    name: pattern.name,
    categoryLabel: cat ? `${cat.typeName} / ${cat.categoryName}` : null,
    categoryColor: cat?.color ?? null,
    merchantName,
    accountName: pattern.account_id
      ? (accounts.get(pattern.account_id)?.name ?? null)
      : null,
    frequencyDays: pattern.frequency_days,
    expectedAmount: pattern.expected_amount != null ? Number(pattern.expected_amount) : null,
    occurrenceCount,
    totalAmount,
    avgAmount,
    minAmount,
    maxAmount,
    firstDate,
    lastDate,
    nextExpected,
    annualized,
    // On garde les 12 derniers versements pour le graphe.
    occurrences: occurrences.slice(-12),
  };
}
