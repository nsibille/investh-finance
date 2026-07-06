import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Renvoie l'id de l'enseigne SANS NOM (groupe « Sans enseigne ») pour une
 * sous-catégorie donnée, en la créant au besoin. Centralise côté application
 * l'invariant « une enseigne sans nom par sous-catégorie » : l'index unique
 * `lower(name)` ne dédoublonne pas les NULL, donc on déduplique ici.
 */
export async function ensureNamelessMerchant(
  supabase: SupabaseServerClient,
  subcategoryId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("merchants")
    .select("id")
    .is("name", null)
    .eq("subcategory_id", subcategoryId)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("merchants")
    .insert({ name: null, subcategory_id: subcategoryId })
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}
