-- ============================================================================
-- FUSION « Règles » → « Enseignes »
-- ----------------------------------------------------------------------------
-- Objectif : une seule entité de catégorisation. Une « enseigne » (merchants)
-- = un nom OPTIONNEL + une catégorie par défaut + N motifs (categorization_rules).
-- Chaque motif appartient désormais TOUJOURS à une enseigne (merchant_id NOT NULL)
-- et hérite de la catégorie de son enseigne (categorization_rules.subcategory_id
-- est supprimé). Les anciennes « règles simples » (sans enseigne) deviennent des
-- enseignes SANS NOM (groupe « Sans enseigne »), une par sous-catégorie.
--
-- Discriminateur : enseigne AVEC nom = vraie marque → le moteur pose merchant_id
-- sur la transaction. Enseigne SANS nom → catégorie seule, merchant_id non posé.
--
-- Migration à application unique (one-shot) : les étapes 2–3 lisent
-- categorization_rules.subcategory_id, supprimée en étape 5. À appliquer via le
-- MCP Supabase (apply_migration), puis régénérer src/types/database.types.ts.
-- ============================================================================

-- 1) Le nom d'enseigne devient optionnel.
--    Le CHECK length(name) BETWEEN 1 AND 120 reste valide (satisfait par NULL).
--    L'index unique lower(name) autorise plusieurs enseignes sans nom (NULL distincts).
ALTER TABLE public.merchants ALTER COLUMN name DROP NOT NULL;

-- 2) Chaque enseigne qui porte des motifs doit avoir une catégorie par défaut
--    (le motif en hérite). Pour les enseignes sans catégorie, on adopte celle de
--    leur motif prioritaire (priority croissante, puis plus ancien).
UPDATE public.merchants m
SET subcategory_id = pick.subcategory_id
FROM (
  SELECT DISTINCT ON (r.merchant_id) r.merchant_id, r.subcategory_id
  FROM public.categorization_rules r
  WHERE r.merchant_id IS NOT NULL AND r.subcategory_id IS NOT NULL
  ORDER BY r.merchant_id, r.priority ASC, r.created_at ASC
) pick
WHERE m.id = pick.merchant_id AND m.subcategory_id IS NULL;

-- 3) Backfill : les règles orphelines (sans enseigne) deviennent des motifs
--    d'enseignes SANS NOM, une enseigne par sous-catégorie distincte.
WITH orphan_subs AS (
  SELECT DISTINCT subcategory_id
  FROM public.categorization_rules
  WHERE merchant_id IS NULL AND subcategory_id IS NOT NULL
),
created AS (
  INSERT INTO public.merchants (name, subcategory_id)
  SELECT NULL, subcategory_id FROM orphan_subs
  RETURNING id, subcategory_id
)
UPDATE public.categorization_rules r
SET merchant_id = created.id
FROM created
WHERE r.merchant_id IS NULL AND r.subcategory_id = created.subcategory_id;

-- 4) Tout motif appartient désormais à une enseigne.
--    Le FK passe en ON DELETE CASCADE : supprimer une enseigne supprime ses motifs
--    (auparavant SET NULL, incompatible avec NOT NULL).
ALTER TABLE public.categorization_rules
  DROP CONSTRAINT IF EXISTS categorization_rules_merchant_id_fkey;
ALTER TABLE public.categorization_rules
  ADD CONSTRAINT categorization_rules_merchant_id_fkey
  FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;
ALTER TABLE public.categorization_rules ALTER COLUMN merchant_id SET NOT NULL;

-- 5) La catégorie du motif vient de l'enseigne : on supprime la colonne dédiée.
--    (drop de l'index + colonne ; le FK subcategory_id est retiré avec la colonne.)
DROP INDEX IF EXISTS public.idx_rules_subcategory;
ALTER TABLE public.categorization_rules DROP COLUMN IF EXISTS subcategory_id;
