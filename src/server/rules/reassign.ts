import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Parmi des motifs candidats (même libellé « contient »), ne garde que ceux
 * rattachés à une enseigne SANS NOM (groupe « Sans enseigne »). Fonction pure
 * pour être testable indépendamment de la base.
 */
export function selectStaleRuleIds(
  candidates: { id: string; merchant_id: string }[],
  namelessMerchantIds: Iterable<string>,
): string[] {
  const nameless = new Set(namelessMerchantIds);
  return candidates
    .filter((r) => nameless.has(r.merchant_id))
    .map((r) => r.id);
}

/**
 * Réassignation d'un libellé à une nouvelle catégorie : supprime les motifs
 * « contient <libellé> » du groupe « Sans enseigne » (enseignes sans nom) qui
 * pointaient vers une AUTRE catégorie, afin qu'un même libellé ne soit mappé
 * qu'à une seule catégorie côté « Sans enseigne » (« supprimer l'ancienne règle
 * et ajouter la nouvelle »).
 *
 * - `keepMerchantId` (l'enseigne sans nom cible) est préservée : on ne supprime
 *   que les doublons rattachés aux autres enseignes sans nom.
 * - `keepMerchantId = null` : le libellé passe sous une enseigne NOMMÉE ; tous
 *   les doublons « Sans enseigne » du libellé sont supprimés (l'enseigne nommée,
 *   qui porte un nom, n'est jamais ciblée).
 *
 * Les enseignes nommées (vraies marques) ne sont jamais touchées : leurs motifs
 * portent une catégorie propre. Renvoie le nombre de motifs supprimés.
 */
export async function purgeNamelessLabelDuplicates(
  supabase: SupabaseServerClient,
  pattern: string,
  keepMerchantId: string | null,
): Promise<number> {
  const p = pattern.trim();
  if (!p) return 0;

  // Motifs « contient » du même libellé (hors enseigne cible le cas échéant).
  let q = supabase
    .from("categorization_rules")
    .select("id, merchant_id")
    .eq("match_type", "contains")
    .ilike("pattern", p);
  if (keepMerchantId) q = q.neq("merchant_id", keepMerchantId);
  const { data: candidates } = await q;
  if (!candidates || candidates.length === 0) return 0;

  // Ne cible que les enseignes SANS NOM (doublons « Sans enseigne »).
  const merchantIds = [...new Set(candidates.map((r) => r.merchant_id))];
  const { data: nameless } = await supabase
    .from("merchants")
    .select("id")
    .in("id", merchantIds)
    .is("name", null);
  const staleIds = selectStaleRuleIds(
    candidates,
    (nameless ?? []).map((m) => m.id),
  );
  if (staleIds.length === 0) return 0;

  const { error } = await supabase
    .from("categorization_rules")
    .delete()
    .in("id", staleIds);
  if (error) return 0;
  return staleIds.length;
}
