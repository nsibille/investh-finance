import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import {
  getTransferSubcategoryIds,
  getIncomeSubcategoryIds,
} from "@/lib/categories/queries";
import { getPersonalAmountAdjustments } from "@/lib/persons/queries";
import { accountingMonth } from "./accounting";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export interface KpiSet {
  revenus: number;
  depenses: number;
  solde: number;
  epargne: number; // %
}

export interface MonthlyKpis {
  current: KpiSet;
  previous: KpiSet;
}

function computeKpis(amounts: number[]): KpiSet {
  let revenus = 0;
  let depenses = 0;
  for (const a of amounts) {
    if (a > 0) revenus += a;
    else depenses += -a;
  }
  const solde = revenus - depenses;
  const epargne = revenus > 0 ? (solde / revenus) * 100 : 0;
  return { revenus, depenses, solde, epargne };
}

export async function getMonthlyKpis(ref: Date): Promise<MonthlyKpis> {
  const supabase = await createClient();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);
  const prevStart = startOfMonth(subMonths(ref, 1));

  const [{ data }, transferIds, incomeIds, { debtByTx, repaymentTxIds }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("id, operation_date, amount, subcategory_id")
        .eq("status", "validated")
        // On élargit la borne basse : un revenu de fin de mois précédent est
        // rattaché au mois suivant (cf. `accountingMonth`), il doit donc être
        // récupéré pour alimenter le bon bucket.
        .gte("operation_date", iso(subDays(prevStart, 7)))
        .lte("operation_date", iso(monthEnd)),
      getTransferSubcategoryIds(),
      getIncomeSubcategoryIds(),
      getPersonalAmountAdjustments(),
    ]);

  const cur: number[] = [];
  const prev: number[] = [];
  const curKey = format(monthStart, "yyyy-MM");
  const prevKey = format(prevStart, "yyyy-MM");
  for (const t of data ?? []) {
    if (t.subcategory_id && transferIds.has(t.subcategory_id)) continue;
    // Remboursement rattaché : pas un revenu (la créance est déjà déduite).
    if (repaymentTxIds.has(t.id)) continue;
    const isIncome =
      Number(t.amount) > 0 &&
      !!t.subcategory_id &&
      incomeIds.has(t.subcategory_id);
    const key = accountingMonth(t.operation_date, isIncome);
    // Créance déduite : on ne garde que ma part (+ les cadeaux).
    const amount = Number(t.amount) + (debtByTx.get(t.id) ?? 0);
    if (key === curKey) cur.push(amount);
    else if (key === prevKey) prev.push(amount);
  }
  return { current: computeKpis(cur), previous: computeKpis(prev) };
}

export interface CategorySlice {
  name: string;
  value: number;
  color: string | null;
}

export async function getCategoryBreakdown(
  ref: Date,
): Promise<CategorySlice[]> {
  const supabase = await createClient();
  const monthStart = iso(startOfMonth(ref));

  const [{ data: rows }, { data: cats }, transferIds] = await Promise.all([
    supabase
      .from("monthly_summary")
      .select("category_id, category_name, total_amount, subcategory_id")
      .eq("month", monthStart),
    supabase.from("categories").select("id, color"),
    getTransferSubcategoryIds(),
  ]);

  const colorMap = new Map((cats ?? []).map((c) => [c.id, c.color]));
  const byCategory = new Map<string, CategorySlice>();

  for (const r of rows ?? []) {
    if (r.subcategory_id && transferIds.has(r.subcategory_id)) continue;
    const amount = Number(r.total_amount);
    if (amount >= 0) continue; // expenses only
    const key = r.category_id ?? r.category_name ?? "—";
    const existing = byCategory.get(key);
    const value = Math.abs(amount);
    if (existing) existing.value += value;
    else
      byCategory.set(key, {
        name: r.category_name ?? "—",
        value,
        color: r.category_id ? (colorMap.get(r.category_id) ?? null) : null,
      });
  }

  return [...byCategory.values()].sort((a, b) => b.value - a.value);
}

export interface TrendPoint {
  month: string;
  revenus: number;
  depenses: number;
}

export async function getMonthlyTrend(
  ref: Date,
  months = 12,
): Promise<TrendPoint[]> {
  const supabase = await createClient();
  const monthEnd = endOfMonth(ref);
  const firstStart = startOfMonth(subMonths(ref, months - 1));

  const [{ data }, transferIds, incomeIds, { debtByTx, repaymentTxIds }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("id, operation_date, amount, subcategory_id")
        .eq("status", "validated")
        // Borne basse élargie pour capter les revenus de fin de mois rattachés
        // au mois suivant (cf. `accountingMonth`).
        .gte("operation_date", iso(subDays(firstStart, 7)))
        .lte("operation_date", iso(monthEnd)),
      getTransferSubcategoryIds(),
      getIncomeSubcategoryIds(),
      getPersonalAmountAdjustments(),
    ]);

  const buckets = new Map<string, { revenus: number; depenses: number }>();
  for (let i = 0; i < months; i++) {
    const d = subMonths(ref, months - 1 - i);
    buckets.set(format(d, "yyyy-MM"), { revenus: 0, depenses: 0 });
  }

  for (const t of data ?? []) {
    if (t.subcategory_id && transferIds.has(t.subcategory_id)) continue;
    if (repaymentTxIds.has(t.id)) continue;
    const isIncome =
      Number(t.amount) > 0 &&
      !!t.subcategory_id &&
      incomeIds.has(t.subcategory_id);
    const key = accountingMonth(t.operation_date, isIncome);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const a = Number(t.amount) + (debtByTx.get(t.id) ?? 0);
    if (a > 0) bucket.revenus += a;
    else bucket.depenses += -a;
  }

  return [...buckets.entries()].map(([key, v]) => ({
    month: format(new Date(`${key}-01`), "LLL", { locale: fr }),
    revenus: v.revenus,
    depenses: v.depenses,
  }));
}
