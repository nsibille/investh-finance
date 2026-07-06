import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSubcategoryOptions } from "@/lib/categories/queries";
import { computeRollups, type PurchaseAmounts } from "./tree";
import type { SplitNature } from "@/lib/persons/types";
import type {
  PurchaseWithDetails,
  PurchaseDetail,
  PurchaseInstallment,
  PurchaseOption,
  PurchaseTxLine,
  PurchasePersonShare,
} from "./types";

export const getPurchases = cache(async function getPurchases(): Promise<
  PurchaseWithDetails[]
> {
  const supabase = await createClient();
  const [
    { data: purchases },
    { data: txs },
    { data: installments },
    { data: accounts },
    { data: merchants },
    { data: shareRows },
    subOptions,
  ] = await Promise.all([
    supabase.from("purchases").select("*").order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select(
        "id, amount, purchase_id, operation_date, label, currency, status, account_id",
      )
      .not("purchase_id", "is", null)
      // Ordre déterministe : récent → ancien, `id` départage les ex æquo.
      .order("operation_date", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("purchase_installments")
      .select("*")
      .order("month", { ascending: true }),
    supabase.from("accounts").select("id, name, color"),
    supabase.from("merchants").select("id, name"),
    // Parts personnes des transactions rattachées à un achat (jointure inner).
    supabase
      .from("transaction_persons")
      .select(
        "share_amount, persons(id, name, color, is_self), transactions!inner(purchase_id, split_nature)",
      ),
    getSubcategoryOptions(),
  ]);

  const subInfo = new Map(
    subOptions.map((o) => [o.id, { label: o.label, color: o.categoryColor }]),
  );
  const accountInfo = new Map(
    (accounts ?? []).map((a) => [a.id, { name: a.name, color: a.color }]),
  );
  const merchantName = new Map(
    (merchants ?? []).map((m) => [m.id, m.name]),
  );

  // Agrège les parts par achat → (personne + nature), en ne gardant que les
  // transactions ventilées (nature non nulle). Sert au bloc « Personnes ».
  const personShares = new Map<string, Map<string, PurchasePersonShare>>();
  for (const r of shareRows ?? []) {
    const tx = r.transactions as unknown as {
      purchase_id: string | null;
      split_nature: SplitNature | null;
    } | null;
    const person = r.persons as unknown as {
      id: string;
      name: string;
      color: string;
      is_self: boolean;
    } | null;
    if (!tx?.purchase_id || !tx.split_nature || !person) continue;
    const byPerson = personShares.get(tx.purchase_id) ?? new Map();
    const key = `${person.id}:${tx.split_nature}`;
    const cur = byPerson.get(key);
    if (cur) {
      cur.amount += Number(r.share_amount);
    } else {
      byPerson.set(key, {
        personId: person.id,
        name: person.name,
        color: person.color,
        isSelf: person.is_self,
        nature: tx.split_nature,
        amount: Number(r.share_amount),
      });
    }
    personShares.set(tx.purchase_id, byPerson);
  }
  const personSharesList = (purchaseId: string): PurchasePersonShare[] => {
    const m = personShares.get(purchaseId);
    if (!m) return [];
    // « Moi » d'abord, puis alphabétique, dette avant cadeau.
    return [...m.values()].sort(
      (a, b) =>
        Number(b.isSelf) - Number(a.isSelf) ||
        a.name.localeCompare(b.name) ||
        a.nature.localeCompare(b.nature),
    );
  };

  // Agrégats (count/sum) + lignes de transactions détaillées, par achat.
  const agg = new Map<string, { count: number; sum: number }>();
  const txLines = new Map<string, PurchaseTxLine[]>();
  for (const t of txs ?? []) {
    if (!t.purchase_id) continue;
    const e = agg.get(t.purchase_id) ?? { count: 0, sum: 0 };
    e.count += 1;
    e.sum += Number(t.amount);
    agg.set(t.purchase_id, e);
    const acc = t.account_id ? accountInfo.get(t.account_id) : null;
    const list = txLines.get(t.purchase_id) ?? [];
    list.push({
      id: t.id,
      operation_date: t.operation_date,
      label: t.label,
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
      accountName: acc?.name ?? null,
      accountColor: acc?.color ?? null,
    });
    txLines.set(t.purchase_id, list);
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
    // « Soldé » : automatique quand un échéancier complet (non-abonnement) est
    // entièrement apparié ; sinon (achats directs / partiels) c'est manuel via
    // `is_settled`. Les abonnements sans fin ne sont jamais auto-soldés.
    const endless = p.is_recurring && !p.recurrence_end;
    const autoSettled = inst.length > 0 && !endless && matched === inst.length;
    const isFullyPaid = p.is_settled || autoSettled;
    const txs = txLines.get(p.id) ?? [];
    // Date de la 1re transaction (plus ancienne) ; sinon date de création.
    const firstTransactionDate = txs.reduce<string | null>(
      (min, t) => (min === null || t.operation_date < min ? t.operation_date : min),
      null,
    );
    return {
      ...p,
      categoryLabel: cat?.label ?? null,
      categoryColor: cat?.color ?? null,
      merchantName: p.merchant_id ? (merchantName.get(p.merchant_id) ?? null) : null,
      transactionCount: a.count,
      paidAmount: a.sum,
      transactions: txs,
      persons: personSharesList(p.id),
      firstTransactionDate,
      autoSettled,
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
  const nameById = new Map(own.map((p) => [p.id, p.name]));

  const detailed = own.map((p): PurchaseWithDetails => {
    const r = rollups.get(p.id);
    return {
      ...p,
      childIds: r?.childIds ?? [],
      descendantCount: r?.descendantCount ?? 0,
      totalPaidAmount: r?.totalPaidAmount ?? p.paidAmount,
      totalTransactionCount: r?.totalTransactionCount ?? p.transactionCount,
      totalForecastAmount: r?.totalForecastAmount ?? p.forecastAmount,
      totalRemaining: r?.totalRemaining ?? p.remaining,
      parentName: p.parent_id ? (nameById.get(p.parent_id) ?? null) : null,
    };
  });

  // Tri : par date de 1re transaction (sinon création), le plus récent en tête.
  // Départage déterministe par created_at puis id.
  const sortKey = (p: PurchaseWithDetails) =>
    p.firstTransactionDate ?? p.created_at.slice(0, 10);
  return detailed.sort(
    (a, b) =>
      sortKey(b).localeCompare(sortKey(a)) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
});

/**
 * Détail complet d'un achat pour `/achats/[id]` : réutilise `getPurchases`
 * (app mono-utilisateur, volume modeste) puis résout parent + sous-achats
 * directs en objets complets. `null` si l'achat n'existe pas.
 */
export async function getPurchaseDetail(
  id: string,
): Promise<PurchaseDetail | null> {
  const all = await getPurchases();
  const self = all.find((p) => p.id === id);
  if (!self) return null;
  const byId = new Map(all.map((p) => [p.id, p]));
  const parent = self.parent_id ? (byId.get(self.parent_id) ?? null) : null;
  const children = self.childIds
    .map((cid) => byId.get(cid))
    .filter((c): c is PurchaseWithDetails => Boolean(c));
  return {
    ...self,
    parent: parent ? { id: parent.id, name: parent.name } : null,
    children,
  };
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
