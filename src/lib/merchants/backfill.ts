import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Fait hériter à l'enseigne parente la catégorie d'une transaction. Si la
 * transaction `transactionId` est rattachée à une enseigne qui n'a pas encore de
 * catégorie par défaut, l'enseigne hérite de `subcategoryId`. Renvoie l'enseigne
 * mise à jour (pour un toaster « l'enseigne a hérité de la catégorie ») ou `null`
 * quand rien ne change (pas d'enseigne, enseigne déjà catégorisée, catégorie
 * vide).
 *
 * Utilisé quand on édite / change la catégorie d'une transaction déjà rattachée
 * à une enseigne sans catégorie (cf. `createMerchant`/`attachTransactionToMerchant`
 * pour l'héritage au moment de la création / du rattachement).
 */
export async function backfillMerchantCategory(
  supabase: SupabaseServerClient,
  transactionId: string,
  subcategoryId: string | null,
): Promise<{ id: string; name: string } | null> {
  if (!subcategoryId) return null;
  const { data: tx } = await supabase
    .from("transactions")
    .select("merchant_id")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx?.merchant_id) return null;
  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, name, subcategory_id")
    .eq("id", tx.merchant_id)
    .maybeSingle();
  if (!merchant || merchant.subcategory_id) return null;
  const { error } = await supabase
    .from("merchants")
    .update({ subcategory_id: subcategoryId })
    .eq("id", merchant.id);
  if (error) return null;
  return { id: merchant.id, name: merchant.name ?? "" };
}
