import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";

export interface MerchantMonthlyPoint {
  month: string; // "YYYY-MM"
  depenses: number; // dépenses du mois (montant positif)
}

export interface MerchantCategorySlice {
  key: string;
  label: string;
  color: string | null;
  amount: number; // dépenses cumulées (positif)
  count: number;
}

export interface MerchantStats {
  id: string;
  name: string;
  categoryLabel: string | null;
  categoryColor: string | null;
  isOnline: boolean;
  country: string | null;
  /** Dépenses cumulées (somme des débits, en valeur absolue). */
  totalSpent: number;
  /** Solde net (crédits − débits, signé). */
  netAmount: number;
  transactionCount: number;
  purchaseCount: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Dépense mensuelle moyenne sur la période d'activité. */
  avgMonthly: number;
  /** Série chronologique des 12 derniers mois (mois vides inclus). */
  monthly: MerchantMonthlyPoint[];
  /** Répartition des dépenses par catégorie, décroissante. */
  categories: MerchantCategorySlice[];
}

/** Nombre de mois calendaires entre deux "YYYY-MM" inclus (≥ 1). */
function monthSpan(first: string, last: string): number {
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  return Math.max(1, (ly - fy) * 12 + (lm - fm) + 1);
}

/** Décrémente un "YYYY-MM" de `n` mois. */
function subtractMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/**
 * Statistiques agrégées d'une enseigne pour le quick view (liste) et la fiche
 * détail : dépenses totales, nombre de transactions, moyenne mensuelle, série
 * mensuelle et répartition par catégorie. Les montants « dépensés » sont en
 * valeur absolue (débits) ; les crédits (remboursements) ne comptent que dans
 * `netAmount`. Le mois courant sert de référence pour la fenêtre 12 mois.
 */
export async function getMerchantStats(
  id: string,
  refMonth: string,
): Promise<MerchantStats | null> {
  const supabase = await createClient();
  const [{ data: merchant }, { data: txs }, { count: purchaseCount }, categories] =
    await Promise.all([
      supabase
        .from("merchants")
        .select("id, name, subcategory_id, is_online, country")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("amount, operation_date, subcategory_id, status")
        .eq("merchant_id", id)
        .neq("status", "ignored"),
      supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", id),
      getCategoryDisplayMap(),
    ]);

  if (!merchant) return null;

  const rows = (txs ?? []) as {
    amount: number;
    operation_date: string;
    subcategory_id: string | null;
  }[];

  let totalSpent = 0;
  let netAmount = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  const byMonth = new Map<string, number>();
  const byCat = new Map<string, MerchantCategorySlice>();

  for (const t of rows) {
    const amount = Number(t.amount);
    netAmount += amount;
    const spend = amount < 0 ? -amount : 0;
    totalSpent += spend;

    if (!firstDate || t.operation_date < firstDate) firstDate = t.operation_date;
    if (!lastDate || t.operation_date > lastDate) lastDate = t.operation_date;

    if (spend > 0) {
      const month = t.operation_date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + spend);

      const disp = t.subcategory_id ? categories.get(t.subcategory_id) : null;
      const key = disp ? disp.categoryName : "__none__";
      const slice = byCat.get(key) ?? {
        key,
        label: disp?.categoryName ?? "Sans catégorie",
        color: disp?.color ?? null,
        amount: 0,
        count: 0,
      };
      slice.amount += spend;
      slice.count += 1;
      byCat.set(key, slice);
    }
  }

  // Série des 12 derniers mois (mois vides à 0) jusqu'au mois de référence.
  const monthly: MerchantMonthlyPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const month = subtractMonths(refMonth, i);
    monthly.push({ month, depenses: byMonth.get(month) ?? 0 });
  }

  const firstMonth = firstDate?.slice(0, 7) ?? null;
  const lastMonth = lastDate?.slice(0, 7) ?? null;
  const span = firstMonth && lastMonth ? monthSpan(firstMonth, lastMonth) : 1;

  return {
    id: merchant.id,
    name: merchant.name ?? "",
    categoryLabel: merchant.subcategory_id
      ? (categories.get(merchant.subcategory_id)?.categoryName ?? null)
      : null,
    categoryColor: merchant.subcategory_id
      ? (categories.get(merchant.subcategory_id)?.color ?? null)
      : null,
    isOnline: merchant.is_online ?? false,
    country: merchant.country ?? null,
    totalSpent,
    netAmount,
    transactionCount: rows.length,
    purchaseCount: purchaseCount ?? 0,
    firstDate,
    lastDate,
    avgMonthly: totalSpent / span,
    monthly,
    categories: [...byCat.values()].sort((a, b) => b.amount - a.amount),
  };
}
