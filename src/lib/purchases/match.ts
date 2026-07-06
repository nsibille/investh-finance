import { createClient } from "@/lib/supabase/server";
import {
  matchInstallmentsToTransactions,
  installmentOccurrence,
  type MatchableInstallment,
  type MatchableTx,
} from "./installments";
import type { Database } from "@/types/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

export interface PreviewRow {
  index: number;
  operation_date: string;
  amount: number;
  raw_label: string;
}
export interface PreviewPurchaseMatch {
  purchaseId: string;
  purchaseName: string;
  subcategoryId: string | null;
  /** Enseigne de l'achat (imposée à la transaction rattachée). */
  merchantId: string | null;
  merchantName: string | null;
  /** Occurrence 1-based de la mensualité appariée (X). */
  occurrence: number | null;
  /** Nombre total de mensualités de l'achat (Y). */
  installmentTotal: number;
  /** Abonnement sans fin : total inconnu (occurrence X/∞). */
  endless: boolean;
}

/**
 * Aperçu d'import : apparie les lignes analysées aux mensualités prévisionnelles
 * non réglées des achats (non archivés). Même règle qu'à l'import — mois +
 * montant, libellé seulement si l'achat a déjà une transaction de référence.
 * Retourne, par index de ligne, l'achat à pré-rattacher.
 */
export async function matchPreviewRowsToPurchases(
  supabase: SupabaseServerClient,
  rows: PreviewRow[],
): Promise<Map<number, PreviewPurchaseMatch>> {
  if (rows.length === 0) return new Map();
  const { data: insts } = await supabase
    .from("purchase_installments")
    .select("id, purchase_id, month, amount, label")
    .is("transaction_id", null);
  if (!insts || insts.length === 0) return new Map();

  const purchaseIds = [...new Set(insts.map((i) => i.purchase_id))];
  const [{ data: purchases }, { data: attached }, { data: allInsts }] =
    await Promise.all([
      supabase
        .from("purchases")
        .select(
          "id, name, subcategory_id, is_archived, merchant_id, is_recurring, recurrence_end",
        )
        .in("id", purchaseIds),
      supabase
        .from("transactions")
        .select("purchase_id")
        .in("purchase_id", purchaseIds),
      // Toutes les mensualités (appariées comprises) : occurrence X/Y fiable.
      supabase
        .from("purchase_installments")
        .select("purchase_id, month")
        .in("purchase_id", purchaseIds),
    ]);
  const pInfo = new Map((purchases ?? []).map((p) => [p.id, p]));
  const hasAttached = new Set(
    (attached ?? []).map((t) => t.purchase_id).filter((x): x is string => !!x),
  );

  // Mois triés par achat → mois de départ (X=1) et total (Y).
  const monthsByPurchase = new Map<string, string[]>();
  for (const i of allInsts ?? []) {
    const list = monthsByPurchase.get(i.purchase_id) ?? [];
    list.push(i.month);
    monthsByPurchase.set(i.purchase_id, list);
  }
  for (const list of monthsByPurchase.values())
    list.sort((a, b) => a.localeCompare(b));
  // Mois de la mensualité appariée (pour l'occurrence).
  const monthByInst = new Map(insts.map((i) => [i.id, i.month]));

  const merchantIds = [
    ...new Set((purchases ?? []).map((p) => p.merchant_id).filter((x): x is string => !!x)),
  ];
  const merchantNames = new Map<string, string>();
  if (merchantIds.length > 0) {
    const { data: merchants } = await supabase
      .from("merchants")
      .select("id, name")
      .in("id", merchantIds);
    for (const m of merchants ?? []) merchantNames.set(m.id, m.name ?? "");
  }

  const items: MatchableInstallment[] = [];
  const purchaseByInst = new Map<string, string>();
  for (const i of insts) {
    const p = pInfo.get(i.purchase_id);
    if (!p || p.is_archived) continue;
    items.push({
      id: i.id,
      month: i.month,
      amount: Number(i.amount),
      // Sans transaction rattachée : aucun libellé de référence fiable.
      label: hasAttached.has(i.purchase_id) ? i.label : null,
    });
    purchaseByInst.set(i.id, i.purchase_id);
  }
  if (items.length === 0) return new Map();

  const candidates: MatchableTx[] = rows.map((r) => ({
    id: String(r.index),
    operation_date: r.operation_date,
    amount: r.amount,
    raw_label: r.raw_label,
  }));

  const out = new Map<number, PreviewPurchaseMatch>();
  for (const { installmentId, transactionId } of matchInstallmentsToTransactions(
    items,
    candidates,
  )) {
    const pid = purchaseByInst.get(installmentId);
    if (!pid) continue;
    const p = pInfo.get(pid);
    const merchantId = p?.merchant_id ?? null;
    const months = monthsByPurchase.get(pid) ?? [];
    const instMonth = monthByInst.get(installmentId);
    const startMonth = months[0] ?? instMonth;
    const occurrence =
      instMonth && startMonth
        ? installmentOccurrence(startMonth, instMonth)
        : null;
    out.set(Number(transactionId), {
      purchaseId: pid,
      purchaseName: p?.name ?? "",
      subcategoryId: p?.subcategory_id ?? null,
      merchantId,
      merchantName: merchantId ? (merchantNames.get(merchantId) ?? null) : null,
      occurrence,
      installmentTotal: months.length,
      endless: !!(p?.is_recurring && !p?.recurrence_end),
    });
  }
  return out;
}

/**
 * Apparie automatiquement les mensualités non réglées aux transactions.
 *
 * - Si l'achat a déjà au moins une transaction rattachée, on utilise le libellé
 *   attendu de la mensualité (mois + montant + libellé) pour rester précis.
 * - Si l'achat n'a AUCUNE transaction (donc aucun libellé de référence fiable),
 *   on apparie uniquement sur le mois et le montant (en valeur absolue : les
 *   montants des transactions sont négatifs).
 *
 * Une transaction non rattachée qui matche est aussi rattachée à l'achat
 * (catégorie héritée). `scopePurchaseId` limite le traitement à un seul achat
 * (utilisé à la création). Retourne le nombre d'appariements.
 */
export async function matchPurchaseInstallments(
  scopePurchaseId?: string,
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("purchase_installments")
    .select("id, purchase_id, month, amount, label")
    .is("transaction_id", null);
  if (scopePurchaseId) query = query.eq("purchase_id", scopePurchaseId);
  const { data: installments } = await query;
  if (!installments || installments.length === 0) return 0;

  const purchaseIds = [...new Set(installments.map((i) => i.purchase_id))];
  const { data: purchases } = await supabase
    .from("purchases")
    .select("id, subcategory_id")
    .in("id", purchaseIds);
  const subByPurchase = new Map(
    (purchases ?? []).map((p) => [p.id, p.subcategory_id]),
  );

  const { data: linkedRows } = await supabase
    .from("purchase_installments")
    .select("transaction_id")
    .not("transaction_id", "is", null);
  const linked = new Set(
    (linkedRows ?? []).map((r) => r.transaction_id).filter((x): x is string => !!x),
  );

  const byPurchase = new Map<string, MatchableInstallment[]>();
  for (const i of installments) {
    const list = byPurchase.get(i.purchase_id) ?? [];
    list.push({ id: i.id, month: i.month, amount: Number(i.amount), label: i.label });
    byPurchase.set(i.purchase_id, list);
  }

  const nowIso = new Date().toISOString();
  let matched = 0;

  for (const [purchaseId, items] of byPurchase) {
    const { data: txs } = await supabase
      .from("transactions")
      .select("id, operation_date, amount, raw_label, purchase_id")
      .or(`purchase_id.is.null,purchase_id.eq.${purchaseId}`);
    const candidates: (MatchableTx & { purchase_id: string | null })[] = (txs ?? [])
      .filter((t) => !linked.has(t.id))
      .map((t) => ({
        id: t.id,
        operation_date: t.operation_date,
        amount: Number(t.amount),
        raw_label: t.raw_label,
        purchase_id: t.purchase_id,
      }));

    // Sans transaction rattachée, aucun libellé de référence : on apparie sur le
    // mois et le montant uniquement.
    const hasAttached = (txs ?? []).some((t) => t.purchase_id === purchaseId);
    const matchItems = hasAttached
      ? items
      : items.map((i) => ({ ...i, label: null }));

    const pairs = matchInstallmentsToTransactions(matchItems, candidates);
    const subId = subByPurchase.get(purchaseId) ?? null;

    for (const { installmentId, transactionId } of pairs) {
      const tx = candidates.find((c) => c.id === transactionId);
      // Aligne le prévisionnel sur le montant réellement matché : la tolérance
      // ±5c peut lier une transaction d'un montant légèrement différent, on
      // remplace alors l'estimation par le montant exact constaté.
      await supabase
        .from("purchase_installments")
        .update({
          transaction_id: transactionId,
          ...(tx ? { amount: tx.amount } : {}),
        })
        .eq("id", installmentId);
      linked.add(transactionId);

      if (tx && !tx.purchase_id) {
        const patch: TransactionUpdate = { purchase_id: purchaseId };
        if (subId) {
          patch.subcategory_id = subId;
          patch.status = "validated";
          patch.validated_at = nowIso;
        }
        await supabase.from("transactions").update(patch).eq("id", transactionId);
      }
      matched += 1;
    }
  }

  return matched;
}
