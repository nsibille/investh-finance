-- ============================================================================
-- VIREMENT PRO + COMPTE COURANT (personne bidirectionnelle)
--
-- Objectif : suivre un « compte courant d'associé » avec une entité (ex. sa
-- société). Deux mouvements, gérés par le concept de « partage » existant :
--   • Virement pro reçu (transaction créditée, montant > 0) partagé en « dette »
--     → argent que JE dois rendre à la personne.
--   • Dépense avancée pour elle (transaction débitée, montant < 0) partagée en
--     « dette » → argent que la personne ME doit.
-- Le solde net se compense automatiquement.
--
-- Choix produit : la catégorie « Virement pro » vit sous le type « Virements »
-- (comme « Virement interne ») → hors budget (exclue des revenus/dépenses).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Catégorie « Virement pro » sous le type « Virements » (hors budget).
-- ---------------------------------------------------------------------------
INSERT INTO public.categories (category_type_id, name, sort_order)
SELECT ct.id, 'Virement pro', 30
FROM public.category_types ct
WHERE ct.slug = 'virements'
ON CONFLICT (category_type_id, name) DO NOTHING;

INSERT INTO public.subcategories (category_id, name, sort_order)
SELECT c.id, '—', 0
FROM public.categories c
JOIN public.category_types t ON t.id = c.category_type_id
WHERE t.slug = 'virements' AND c.name = 'Virement pro'
ON CONFLICT (category_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) transaction_debt_adjustments : la réintégration d'une part « dette » dans
--    une dépense personnelle ne concerne QUE les dépenses (montant < 0). Une
--    part « dette » sur une transaction créditée (montant > 0) est un « je dois »
--    (virement pro) : elle ne doit jamais gonfler une dépense.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.transaction_debt_adjustments
WITH (security_invoker = true) AS
SELECT
  tp.transaction_id,
  SUM(tp.share_amount) AS debt_amount
FROM public.transaction_persons tp
JOIN public.persons p ON p.id = tp.person_id AND p.is_self = false
JOIN public.transactions t
  ON t.id = tp.transaction_id AND t.split_nature = 'debt' AND t.amount < 0
GROUP BY tp.transaction_id;

-- ---------------------------------------------------------------------------
-- 3) person_balances : solde SIGNÉ (compte courant).
--    La direction d'une part « dette » découle du signe de la transaction :
--      • montant < 0 (dépense avancée)  → la personne ME doit  (debt_owed_to_me)
--      • montant > 0 (virement pro reçu) → JE lui dois          (debt_i_owe)
--    net_balance > 0 : la personne me doit ; net_balance < 0 : je lui dois.
--    Colonnes historiques conservées (total_debt / outstanding_debt = « on me
--    doit »), + i_owe et net_balance.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.person_balances
WITH (security_invoker = true) AS
SELECT
  p.id AS person_id,
  p.name,
  p.is_self,
  p.color,
  p.is_archived,
  (COALESCE(tx.debt_owed_to_me, 0) + COALESCE(man.debt, 0)) AS total_debt,
  (COALESCE(tx.gift, 0) + COALESCE(man.gift, 0)) AS total_gift,
  COALESCE(rep.total_repaid, 0) AS total_repaid,
  (COALESCE(tx.debt_owed_to_me, 0) + COALESCE(man.debt, 0) - COALESCE(rep.total_repaid, 0)) AS outstanding_debt,
  COALESCE(tx.debt_i_owe, 0) AS i_owe,
  (
    COALESCE(tx.debt_owed_to_me, 0) + COALESCE(man.debt, 0)
    - COALESCE(rep.total_repaid, 0)
    - COALESCE(tx.debt_i_owe, 0)
  ) AS net_balance
FROM public.persons p
LEFT JOIN (
  SELECT
    tp.person_id,
    SUM(tp.share_amount) FILTER (WHERE t.split_nature = 'debt' AND t.amount < 0) AS debt_owed_to_me,
    SUM(tp.share_amount) FILTER (WHERE t.split_nature = 'debt' AND t.amount > 0) AS debt_i_owe,
    SUM(tp.share_amount) FILTER (WHERE t.split_nature = 'gift') AS gift
  FROM public.transaction_persons tp
  JOIN public.transactions t ON t.id = tp.transaction_id
  GROUP BY tp.person_id
) tx ON tx.person_id = p.id AND p.is_self = false
LEFT JOIN (
  SELECT
    person_id,
    SUM(amount) FILTER (WHERE nature = 'debt') AS debt,
    SUM(amount) FILTER (WHERE nature = 'gift') AS gift
  FROM public.person_manual_entries
  GROUP BY person_id
) man ON man.person_id = p.id AND p.is_self = false
LEFT JOIN (
  SELECT person_id, SUM(amount) AS total_repaid
  FROM public.person_repayments
  GROUP BY person_id
) rep ON rep.person_id = p.id;
