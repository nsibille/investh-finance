import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  matchInternalTransfers,
  type TransferCandidate,
} from "@/lib/transactions/transferMatch";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Id de la sous-catégorie « Virement interne » (— sous le type « Virements »). */
export async function getInternalTransferSubcategoryId(
  supabase: Supa,
): Promise<string | null> {
  const { data } = await supabase
    .from("subcategories")
    .select("id, categories!inner(name)")
    .eq("categories.name", "Virement interne")
    .limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Détecte et catégorise les virements internes parmi les transactions non
 * catégorisées (sortie/entrée opposées sur deux comptes, à quelques jours
 * d'écart). Les deux lignes reçoivent la sous-catégorie « Virement interne »
 * et passent en « validée ». Retourne le nombre de paires détectées.
 */
export async function detectAndTagInternalTransfers(
  windowDays = 4,
): Promise<number> {
  const supabase = await createClient();
  const subId = await getInternalTransferSubcategoryId(supabase);
  if (!subId) return 0;

  const { data } = await supabase
    .from("transactions")
    .select("id, account_id, amount, operation_date")
    .is("subcategory_id", null)
    .neq("status", "ignored");

  const txs: TransferCandidate[] = (data ?? []).map((t) => ({
    id: t.id,
    account_id: t.account_id,
    amount: Number(t.amount),
    operation_date: t.operation_date,
  }));

  const pairs = matchInternalTransfers(txs, windowDays);
  if (pairs.length === 0) return 0;

  const nowIso = new Date().toISOString();
  // Chaque paire reçoit son propre `transfer_group_id` : les deux jambes sont
  // ainsi reliées et réconciliables (net 0), au lieu d'un simple tag commun.
  for (const [negId, posId] of pairs) {
    await supabase
      .from("transactions")
      .update({
        subcategory_id: subId,
        status: "validated",
        validated_at: nowIso,
        transfer_group_id: randomUUID(),
      })
      .in("id", [negId, posId]);
  }
  return pairs.length;
}
