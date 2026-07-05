import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { computeRollups, type PurchaseAmounts } from "./tree";
import type {
  PurchaseWithDetails,
  PurchaseInstallment,
  PurchaseOption,
} from "./types";

export async function getPurchases(): Promise<PurchaseWithDetails[]> {
  const supabase = await createClient();
  const [{ data: purchases }, { data: txs }, { data: installments }, subOptions] =
    await Promise.all([
      supabase.from("purchases").select("*").order("created_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("id, amount, purchase_id")
        .not("purchase_id", "is", null),
      supabase
        .from("purchase_installments")
        .select("*")
        .order("month", { ascending: true }),
      getSubcategoryOptions(),
    ]);

  const subInfo = new Map(
    subOptions.map((o) => [o.id, { label: o.label, color: o.categoryColor }]),
  );

  const agg = new Map<string, { count: number; sum: number }>();
  for (const t of txs ?? []) {
    if (!t.purchase_id) continue;
    const e = agg.get(t.purchase_id) ?? { count: 0, sum: 0 };
    e.count += 1;
    e.sum += Number(t.amount);
    agg.set(t.purchase_id, e);
  }

  const byPurchase = new Map<string, PurchaseInstallment[]>();
  for (const i of installments ?? []) {
    const list = byPurchase.get(i.purchase_id) ?? [];
    list.push(i);
    byPurchase.set(i.purchase_id, list);
  }

  // 1er passage : montants propres à chaque achat (hors descendants).
  const own = (purchases ?? []).map((p) => {
    const a = agg.get(p.id) ?? { count: 0, sum: 0 };
    const inst = byPurchase.get(p.id) ?? [];
    const cat = p.subcategory_id ? subInfo.get(p.subcategory_id) : null;
    const matched = inst.filter((i) => i.transaction_id).length;
    const remaining = inst
      .filter((i) => !i.transaction_id)
      .reduce((s, i) => s + Math.abs(Number(i.amount)), 0);
    const isFullyPaid =
      inst.length > 0 ? matched === inst.length : a.count > 0;
    return {
      ...p,
      categoryLabel: cat?.label ?? null,
      categoryColor: cat?.color ?? null,
      transactionCount: a.count,
      paidAmount: a.sum,
      installments: inst,
      forecastAmount: inst.reduce((s, i) => s + Number(i.amount), 0),
      matchedInstallments: matched,
      isFullyPaid,
      remaining,
    };
  });

  // 2e passage : agrégats de groupe (self + descendants) via l'arborescence.
  const rollupInput: PurchaseAmounts[] = own.map((p) => ({
    id: p.id,
    parentId: p.parent_id,
    paidAmount: p.paidAmount,
    transactionCount: p.transactionCount,
    forecastAmount: p.forecastAmount,
    remaining: p.remaining,
  }));
  const rollups = computeRollups(rollupInput);

  return own.map((p): PurchaseWithDetails => {
    const r = rollups.get(p.id);
    return {
      ...p,
      childIds: r?.childIds ?? [],
      descendantCount: r?.descendantCount ?? 0,
      totalPaidAmount: r?.totalPaidAmount ?? p.paidAmount,
      totalTransactionCount: r?.totalTransactionCount ?? p.transactionCount,
      totalForecastAmount: r?.totalForecastAmount ?? p.forecastAmount,
      totalRemaining: r?.totalRemaining ?? p.remaining,
    };
  });
}

/** Options légères (id, nom, sous-catégorie) pour l'autocomplétion à l'import. */
export const getPurchaseOptions = cache(async function getPurchaseOptions(): Promise<
  PurchaseOption[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select(
      "id, name, subcategory_id, merchant_id, is_recurring, recurrence_end, merchant:merchants(name), installments:purchase_installments(id, month, amount, transaction_id)",
    )
    .order("name", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    subcategoryId: p.subcategory_id,
    merchantId: p.merchant_id,
    merchantName: p.merchant?.name ?? null,
    installmentMonths: (p.installments ?? [])
      .map((i) => i.month)
      .sort((a, b) => a.localeCompare(b)),
    // Échéances prévisionnelles pas encore appariées à une opération.
    unmatchedInstallments: (p.installments ?? [])
      .filter((i) => !i.transaction_id)
      .map((i) => ({ id: i.id, month: i.month, amount: Number(i.amount) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    endless: !!(p.is_recurring && !p.recurrence_end),
  }));
});
