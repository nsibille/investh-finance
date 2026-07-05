import { createClient } from "@/lib/supabase/server";
import { normalizeLabel } from "./dedup";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Débit différé : ligne de consolidation carte (« DEBIT DIFFERE … ») qui
 * regroupe des opérations déjà comptées individuellement. On la sort de la
 * compta (catégorie sous le type « Virements », exclu des agrégats).
 */
export function isDeferredDebit(rawLabel: string): boolean {
  const n = normalizeLabel(rawLabel);
  return n.includes("DEBIT DIFFERE") || n.includes("DEBIT DIFF ");
}

/** Id de la sous-catégorie « — » sous la catégorie « Débit différé ». */
export async function getDeferredDebitSubcategoryId(
  supabase: Supa,
): Promise<string | null> {
  const { data } = await supabase
    .from("subcategories")
    .select("id, categories!inner(name)")
    .eq("categories.name", "Débit différé")
    .limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Catégorise les débits différés non catégorisés existants en « Débit différé »
 * (validés). Retourne le nombre de lignes taguées.
 */
export async function detectAndTagDeferredDebits(): Promise<number> {
  const supabase = await createClient();
  const subId = await getDeferredDebitSubcategoryId(supabase);
  if (!subId) return 0;

  const { data } = await supabase
    .from("transactions")
    .select("id, raw_label")
    .is("subcategory_id", null)
    .neq("status", "ignored");

  const ids = (data ?? [])
    .filter((t) => isDeferredDebit(t.raw_label))
    .map((t) => t.id);
  if (ids.length === 0) return 0;

  const nowIso = new Date().toISOString();
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    await supabase
      .from("transactions")
      .update({ subcategory_id: subId, status: "validated", validated_at: nowIso })
      .in("id", ids.slice(i, i + CHUNK));
  }
  return ids.length;
}
