import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { getCategoryDisplayMap } from "@/lib/transactions/queries";
import {
  internalTransferSubIds,
  isLinkedInternalTransfer,
} from "@/lib/transactions/internalTransfers";
import type { DashTx } from "@/lib/dashboard/analysis";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Agrégat d'une catégorie ou sous-catégorie sur la fenêtre choisie. */
export interface CategoryStat {
  /** Total signé des transactions validées (revenus +, dépenses −). */
  total: number;
  count: number;
  /** 10 plus grosses opérations (par magnitude) de la portée. */
  top: DashTx[];
}

export interface CategoryStatsResult {
  /** Stats par sous-catégorie (id de sous-catégorie). */
  bySub: Record<string, CategoryStat>;
  /** Stats par catégorie (id de catégorie) — cumul de ses sous-catégories. */
  byCat: Record<string, CategoryStat>;
  months: string[]; // 12 clés YYYY-MM
  monthLabels: string[];
  zoom: string | null;
  /** Bornes ISO de la fenêtre (pour le drill-down vers le listing). */
  from: string;
  to: string;
}

interface TxAcc {
  total: number;
  count: number;
  txs: DashTx[];
}

/** 10 plus grosses opérations par magnitude. */
function topTen(txs: DashTx[]): DashTx[] {
  return [...txs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10);
}

/**
 * Statistiques par catégorie et sous-catégorie sur une fenêtre temporelle :
 * année glissante (12 mois) par défaut, ou un mois précis (`zoom`). Total signé,
 * nombre d'opérations et top 10 par nœud. Fenêtré sur `accounting_date` pour
 * coller exactement au listing filtré (date de rattachement des revenus).
 */
export async function getCategoryStats(
  ref: Date,
  zoom: string | null = null,
  months = 12,
): Promise<CategoryStatsResult> {
  const supabase = await createClient();

  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++)
    monthKeys.push(format(subMonths(ref, months - 1 - i), "yyyy-MM"));
  const monthLabels = monthKeys.map((k) =>
    format(new Date(`${k}-01`), "LLL", { locale: fr }),
  );

  const from = zoom ? `${zoom}-01` : iso(startOfMonth(subMonths(ref, months - 1)));
  const to = iso(
    zoom ? endOfMonth(new Date(`${zoom}-01T00:00:00`)) : endOfMonth(ref),
  );

  const [{ data }, categories, { data: merchantsData }, { data: purchasesData }, { data: recurringData }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, amount, subcategory_id, transfer_group_id, operation_date, label, raw_label, merchant_id, purchase_id, recurring_pattern_id",
        )
        .eq("status", "validated")
        .gte("accounting_date", from)
        .lte("accounting_date", to)
        .not("subcategory_id", "is", null),
      getCategoryDisplayMap(),
      supabase.from("merchants").select("id, name"),
      supabase.from("purchases").select("id, name"),
      supabase.from("recurring_patterns").select("id, name"),
    ]);

  const merchantName = new Map((merchantsData ?? []).map((m) => [m.id, m.name]));
  const purchaseName = new Map((purchasesData ?? []).map((p) => [p.id, p.name]));
  const recurringName = new Map((recurringData ?? []).map((r) => [r.id, r.name]));

  // Virements internes reliés : neutralisés (simple déplacement entre comptes).
  const internalIds = internalTransferSubIds(categories);

  const subAcc = new Map<string, TxAcc>();
  for (const t of data ?? []) {
    const subId = t.subcategory_id;
    if (!subId) continue;
    if (isLinkedInternalTransfer(t, internalIds)) continue;
    const disp = categories.get(subId);
    if (!disp) continue;
    const acc = subAcc.get(subId) ?? { total: 0, count: 0, txs: [] };
    const amount = Number(t.amount);
    acc.total += amount;
    acc.count += 1;
    const rawSub = disp.subcategoryName;
    acc.txs.push({
      id: t.id,
      date: t.operation_date,
      label: (t.label && t.label.trim()) || t.raw_label,
      amount,
      categoryName: disp.categoryName,
      categoryColor: disp.color,
      subName: rawSub && rawSub !== "—" ? rawSub : null,
      merchant: t.merchant_id ? (merchantName.get(t.merchant_id) ?? null) : null,
      purchase: t.purchase_id ? (purchaseName.get(t.purchase_id) ?? null) : null,
      recurring: t.recurring_pattern_id
        ? (recurringName.get(t.recurring_pattern_id) ?? null)
        : null,
    });
    subAcc.set(subId, acc);
  }

  const bySub: Record<string, CategoryStat> = {};
  const catAcc = new Map<string, TxAcc>();
  for (const [subId, acc] of subAcc) {
    bySub[subId] = { total: acc.total, count: acc.count, top: topTen(acc.txs) };
    const catId = categories.get(subId)?.categoryId;
    if (!catId) continue;
    const c = catAcc.get(catId) ?? { total: 0, count: 0, txs: [] };
    c.total += acc.total;
    c.count += acc.count;
    c.txs.push(...acc.txs);
    catAcc.set(catId, c);
  }

  const byCat: Record<string, CategoryStat> = {};
  for (const [catId, c] of catAcc)
    byCat[catId] = { total: c.total, count: c.count, top: topTen(c.txs) };

  return { bySub, byCat, months: monthKeys, monthLabels, zoom, from, to };
}
