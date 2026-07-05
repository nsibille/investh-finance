import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import type { MerchantWithDetails, MerchantOption, MerchantRule } from "./types";

export async function getMerchants(): Promise<MerchantWithDetails[]> {
  const supabase = await createClient();
  const [
    { data: merchants },
    { data: txs },
    { data: purchases },
    { data: rules },
    subOptions,
  ] = await Promise.all([
    supabase.from("merchants").select("*").order("name", { ascending: true }),
    supabase
      .from("transactions")
      .select("id, merchant_id")
      .not("merchant_id", "is", null),
    supabase
      .from("purchases")
      .select("id, merchant_id")
      .not("merchant_id", "is", null),
    supabase
      .from("categorization_rules")
      .select("id, name, match_type, pattern, is_active, hit_count, merchant_id")
      .not("merchant_id", "is", null)
      .order("priority", { ascending: true }),
    getSubcategoryOptions(),
  ]);

  const subInfo = new Map(
    subOptions.map((o) => [o.id, { label: o.label, color: o.categoryColor }]),
  );

  const txCount = new Map<string, number>();
  for (const t of txs ?? []) {
    if (!t.merchant_id) continue;
    txCount.set(t.merchant_id, (txCount.get(t.merchant_id) ?? 0) + 1);
  }
  const purchaseCount = new Map<string, number>();
  for (const p of purchases ?? []) {
    if (!p.merchant_id) continue;
    purchaseCount.set(p.merchant_id, (purchaseCount.get(p.merchant_id) ?? 0) + 1);
  }
  const rulesByMerchant = new Map<string, MerchantRule[]>();
  for (const r of rules ?? []) {
    if (!r.merchant_id) continue;
    const list = rulesByMerchant.get(r.merchant_id) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      match_type: r.match_type,
      pattern: r.pattern,
      is_active: r.is_active,
      hit_count: r.hit_count,
    });
    rulesByMerchant.set(r.merchant_id, list);
  }

  return (merchants ?? []).map((m) => {
    const cat = m.subcategory_id ? subInfo.get(m.subcategory_id) : null;
    return {
      ...m,
      categoryLabel: cat?.label ?? null,
      categoryColor: cat?.color ?? null,
      transactionCount: txCount.get(m.id) ?? 0,
      purchaseCount: purchaseCount.get(m.id) ?? 0,
      rules: rulesByMerchant.get(m.id) ?? [],
    };
  });
}

/** Options légères (id, nom, catégorie par défaut) pour l'autocomplétion. */
export const getMerchantOptions = cache(async function getMerchantOptions(): Promise<
  MerchantOption[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("merchants")
    .select("id, name, subcategory_id")
    .order("name", { ascending: true });
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    subcategoryId: m.subcategory_id,
  }));
});
