import { subDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountDisplayMap,
  getCategoryDisplayMap,
} from "@/lib/transactions/queries";
import { matchesPattern, patternStatus, nextExpectedDate } from "./checker";
import type { Database } from "@/types/database.types";
import type { PatternStatus } from "./checker";

export type RecurringPattern =
  Database["public"]["Tables"]["recurring_patterns"]["Row"];

export interface RecurringPatternView extends RecurringPattern {
  status: PatternStatus;
  effectiveLastSeen: string | null;
  nextExpected: string | null;
  accountName: string | null;
  categoryLabel: string | null;
  merchantName: string | null;
}

export async function getRecurringPatterns(): Promise<RecurringPatternView[]> {
  const supabase = await createClient();
  const since = format(subDays(new Date(), 200), "yyyy-MM-dd");

  const [{ data: patterns }, { data: recentTx }, { data: merchants }, accounts, categories] =
    await Promise.all([
      supabase
        .from("recurring_patterns")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("transactions")
        .select("account_id, raw_label, amount, operation_date")
        .eq("status", "validated")
        .gte("operation_date", since),
      supabase.from("merchants").select("id, name"),
      getAccountDisplayMap(),
      getCategoryDisplayMap(),
    ]);

  const merchantNames = new Map((merchants ?? []).map((m) => [m.id, m.name]));

  const txs = (recentTx ?? []).map((t) => ({
    account_id: t.account_id,
    raw_label: t.raw_label,
    amount: Number(t.amount),
    operation_date: t.operation_date,
  }));

  return (patterns ?? []).map((p) => {
    let latest: string | null = p.last_seen_at;
    for (const tx of txs) {
      if (matchesPattern(p, tx) && (!latest || tx.operation_date > latest)) {
        latest = tx.operation_date;
      }
    }
    const status = patternStatus(p, latest);
    const next = nextExpectedDate(latest, p.frequency_days);
    const cat = p.subcategory_id ? categories.get(p.subcategory_id) : undefined;
    return {
      ...p,
      status,
      effectiveLastSeen: latest,
      nextExpected: next ? format(next, "yyyy-MM-dd") : null,
      accountName: p.account_id
        ? (accounts.get(p.account_id)?.name ?? null)
        : null,
      categoryLabel: cat ? `${cat.typeName} / ${cat.categoryName}` : null,
      merchantName: p.merchant_id ? (merchantNames.get(p.merchant_id) ?? null) : null,
    };
  });
}

export async function getMissingRecurring(): Promise<RecurringPatternView[]> {
  const all = await getRecurringPatterns();
  return all.filter((p) => p.status === "missing");
}

export interface RecurringOption {
  id: string;
  name: string;
  subcategoryId: string | null;
  merchantId: string | null;
  merchantName: string | null;
}

/** Options (id, nom, catégorie, enseigne) pour rattacher une transaction. */
export async function getRecurringOptions(): Promise<RecurringOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_patterns")
    .select("id, name, subcategory_id, merchant_id, merchant:merchants(name)")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data ?? []).map((r) => {
    const m = r.merchant as { name: string } | { name: string }[] | null;
    return {
      id: r.id,
      name: r.name,
      subcategoryId: r.subcategory_id,
      merchantId: r.merchant_id,
      merchantName: Array.isArray(m) ? (m[0]?.name ?? null) : (m?.name ?? null),
    };
  });
}
