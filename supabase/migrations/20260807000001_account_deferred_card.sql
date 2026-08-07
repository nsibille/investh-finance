-- ============================================================================
-- Carte à débit différé : dédup au mois, pas au jour
-- ============================================================================
-- Sur un compte carte à débit différé (ex. BforBank), les opérations peuvent
-- s'afficher provisoirement à la fin du mois en cours puis se recaler à leur
-- date réelle. Le rapprochement des doublons à l'import doit donc comparer au
-- MOIS (compte + mois + montant + libellé compatible) et non au jour, sinon la
-- même opération est ré-importée en double.
--
-- Ce drapeau marque les comptes concernés ; la logique de dédup (côté app)
-- passe alors la signature « inter-source » à une granularité mensuelle.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_deferred_card boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.accounts.is_deferred_card IS
  'Compte carte à débit différé : la détection des doublons à l''import compare au mois (dates provisoires en fin de mois) au lieu du jour.';
