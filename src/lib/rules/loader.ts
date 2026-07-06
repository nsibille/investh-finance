import type { createClient } from "@/lib/supabase/server";
import { toEngineRule, type EngineRule } from "./engine";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Charge les motifs actifs joints à leur enseigne (nom + catégorie par défaut),
 * prêts pour `applyRules`. Renvoie aussi les compteurs de hits initiaux pour la
 * mise à jour post-import. Les enseignes sont peu nombreuses : on les charge en
 * bloc et on indexe par id (évite les fragilités de typage des jointures PostgREST).
 */
export async function loadEngineRules(
  supabase: SupabaseServerClient,
): Promise<{ rules: EngineRule[]; hitBase: Map<string, number> }> {
  const [{ data: ruleRows }, { data: merchants }] = await Promise.all([
    supabase
      .from("categorization_rules")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true }),
    supabase.from("merchants").select("id, name, subcategory_id"),
  ]);

  const rows = ruleRows ?? [];
  const merchantById = new Map(
    (merchants ?? []).map((m) => [m.id, m]),
  );
  const rules = rows.map((r) =>
    toEngineRule(r, merchantById.get(r.merchant_id) ?? null),
  );
  const hitBase = new Map(rows.map((r) => [r.id, r.hit_count]));
  return { rules, hitBase };
}
