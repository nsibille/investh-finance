-- ⚠️ MODE MONO-UTILISATEUR SANS LOGIN (données de test uniquement).
-- Sur décision du propriétaire : l'accès n'exige plus de session authentifiée.
-- is_owner() renvoie true → les policies RLS existantes laissent passer la clé
-- anon (donc l'app sans connexion). À NE PAS utiliser avec des données réelles.
--
-- Pour re-sécuriser (whitelist Google), rejouer :
--   CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean
--   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
--   AS $$ SELECT auth.jwt() ->> 'email' = 'nicolas.h.sibille@gmail.com' $$;
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true
$$;
