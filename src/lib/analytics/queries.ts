import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export interface TopTransaction {
  id: string;
  date: string;
  label: string;
  amount: number;
  category: string | null;
}

export interface TopCategory {
  name: string;
  total: number;
  color: string | null;
}

export interface ComparisonRow {
  category: string;
  current: number;
  previous: number;
  average: number;
}

export interface NetWorthPoint {
  month: string;
  total: number;
}

export interface Analytics {
  topTransactions: TopTransaction[];
  topCategories: TopCategory[];
  comparison: ComparisonRow[];
  netWorth: NetWorthPoint[];
}

export async function getAnalytics(ref: Date): Promise<Analytics> {
  const supabase = await createClient();
  const [{ data: txs }, { data: accounts }, categories] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, label, amount, operation_date, subcategory_id")
      .eq("status", "validated"),
    supabase.from("accounts").select("initial_balance, is_archived"),
    getCategoryDisplayMap(),
  ]);

  const all = (txs ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    amount: Number(t.amount),
    date: t.operation_date,
    cat: t.subcategory_id ? categories.get(t.subcategory_id) : undefined,
  }));

  const monthStart = iso(startOfMonth(ref));
  const monthEnd = iso(endOfMonth(ref));
  const window12Start = iso(startOfMonth(subMonths(ref, 11)));

  // Top 10 expenses over the last 12 months.
  const topTransactions: TopTransaction[] = all
    .filter((t) => t.amount < 0 && t.date >= window12Start && t.date <= monthEnd)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      date: t.date,
      label: t.label,
      amount: t.amount,
      category: t.cat ? t.cat.categoryName : null,
    }));

  // Top categories (expenses) over the last 12 months.
  const catTotals = new Map<string, TopCategory>();
  for (const t of all) {
    if (t.amount >= 0 || !t.cat) continue;
    if (t.date < window12Start || t.date > monthEnd) continue;
    const key = t.cat.categoryName;
    const entry = catTotals.get(key) ?? {
      name: key,
      total: 0,
      color: t.cat.color,
    };
    entry.total += -t.amount;
    catTotals.set(key, entry);
  }
  const topCategories = [...catTotals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Comparison: current vs previous month vs 12-month average, for top categories.
  const prevStart = iso(startOfMonth(subMonths(ref, 1)));
  const prevEnd = iso(endOfMonth(subMonths(ref, 1)));
  const comparison: ComparisonRow[] = topCategories.slice(0, 6).map((c) => {
    let current = 0;
    let previous = 0;
    let total12 = 0;
    for (const t of all) {
      if (t.amount >= 0 || t.cat?.categoryName !== c.name) continue;
      const v = -t.amount;
      if (t.date >= monthStart && t.date <= monthEnd) current += v;
      if (t.date >= prevStart && t.date <= prevEnd) previous += v;
      if (t.date >= window12Start && t.date <= monthEnd) total12 += v;
    }
    return { category: c.name, current, previous, average: total12 / 12 };
  });

  // Net worth evolution: baseline (initial balances) + cumulative validated tx.
  const baseline = (accounts ?? [])
    .filter((a) => !a.is_archived)
    .reduce((s, a) => s + Number(a.initial_balance), 0);

  const netWorth: NetWorthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const mEnd = endOfMonth(subMonths(ref, i));
    const mEndStr = iso(mEnd);
    const cumulative = all
      .filter((t) => t.date <= mEndStr)
      .reduce((s, t) => s + t.amount, 0);
    netWorth.push({
      month: format(mEnd, "LLL", { locale: fr }),
      total: baseline + cumulative,
    });
  }

  return { topTransactions, topCategories, comparison, netWorth };
}
