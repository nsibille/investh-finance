import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSubcategoryOptions } from "@/lib/categories/queries";
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

  return (purchases ?? []).map((p) => {
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
}

/** Options légères (id, nom, sous-catégorie) pour l'autocomplétion à l'import. */
export const getPurchaseOptions = cache(async function getPurchaseOptions(): Promise<
  PurchaseOption[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select("id, name, subcategory_id, merchant_id, merchant:merchants(name)")
    .order("name", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    subcategoryId: p.subcategory_id,
    merchantId: p.merchant_id,
    merchantName: p.merchant?.name ?? null,
  }));
});
