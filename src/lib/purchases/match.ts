import { createClient } from "@/lib/supabase/server";
import {
  matchInstallmentsToTransactions,
  type MatchableInstallment,
  type MatchableTx,
} from "./installments";
import type { Database } from "@/types/database.types";

type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

/**
 * Apparie automatiquement les mensualités non réglées aux transactions (mois +
 * montant + libellé). Une transaction non rattachée qui matche est aussi
 * rattachée à l'achat (catégorie héritée). Retourne le nombre d'appariements.
 */
export async function matchPurchaseInstallments(): Promise<number> {
  const supabase = await createClient();
  const { data: installments } = await supabase
    .from("purchase_installments")
    .select("id, purchase_id, month, amount, label")
    .is("transaction_id", null);
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

    const pairs = matchInstallmentsToTransactions(items, candidates);
    const subId = subByPurchase.get(purchaseId) ?? null;

    for (const { installmentId, transactionId } of pairs) {
      await supabase
        .from("purchase_installments")
        .update({ transaction_id: transactionId })
        .eq("id", installmentId);
      linked.add(transactionId);

      const tx = candidates.find((c) => c.id === transactionId);
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
