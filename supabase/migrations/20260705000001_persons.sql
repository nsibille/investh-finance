-- ============================================================================
-- PERSONS — ventilation des transactions entre personnes (dette / cadeau),
--           suivi des remboursements.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE split_nature AS ENUM ('debt','gift');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- TABLE : persons
CREATE TABLE IF NOT EXISTS public.persons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  is_self     boolean NOT NULL DEFAULT false,
  color       text NOT NULL DEFAULT '#5B5BD6',
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_name_ci ON public.persons (lower(name));
-- Un seul "moi"
CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_single_self ON public.persons (is_self) WHERE is_self = true;
DROP TRIGGER IF EXISTS trg_persons_updated_at ON public.persons;
CREATE TRIGGER trg_persons_updated_at BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY persons_select ON public.persons FOR SELECT USING (public.is_owner());
CREATE POLICY persons_insert ON public.persons FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY persons_update ON public.persons FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY persons_delete ON public.persons FOR DELETE USING (public.is_owner());

-- COLONNE : transactions.split_nature (global à la transaction ; s'applique
--           aux parts des personnes ≠ moi : 'debt' = créance, 'gift' = cadeau)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS split_nature split_nature;

-- TABLE : transaction_persons (part de chaque personne sur une transaction)
CREATE TABLE IF NOT EXISTS public.transaction_persons (
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  person_id      uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  share_amount   numeric(14,2) NOT NULL DEFAULT 0 CHECK (share_amount >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_transaction_persons_person ON public.transaction_persons(person_id);

ALTER TABLE public.transaction_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_persons_select ON public.transaction_persons FOR SELECT USING (public.is_owner());
CREATE POLICY transaction_persons_insert ON public.transaction_persons FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY transaction_persons_update ON public.transaction_persons FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY transaction_persons_delete ON public.transaction_persons FOR DELETE USING (public.is_owner());

-- TABLE : person_repayments (remboursements — manuel ou transaction bancaire liée)
CREATE TABLE IF NOT EXISTS public.person_repayments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id      uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  repaid_on      date NOT NULL DEFAULT CURRENT_DATE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_person_repayments_person ON public.person_repayments(person_id);
CREATE INDEX IF NOT EXISTS idx_person_repayments_transaction ON public.person_repayments(transaction_id);
DROP TRIGGER IF EXISTS trg_person_repayments_updated_at ON public.person_repayments;
CREATE TRIGGER trg_person_repayments_updated_at BEFORE UPDATE ON public.person_repayments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.person_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_repayments_select ON public.person_repayments FOR SELECT USING (public.is_owner());
CREATE POLICY person_repayments_insert ON public.person_repayments FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY person_repayments_update ON public.person_repayments FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY person_repayments_delete ON public.person_repayments FOR DELETE USING (public.is_owner());

-- SEED : la personne "moi" (utilisateur principal). Idempotent.
INSERT INTO public.persons (name, is_self)
SELECT 'Moi', true
WHERE NOT EXISTS (SELECT 1 FROM public.persons WHERE is_self = true);

-- ============================================================================
-- VUE : transaction_debt_adjustments — part "dette" (personnes ≠ moi) par tx.
--        Sert à déduire les créances des dépenses perso.
-- ============================================================================
CREATE OR REPLACE VIEW public.transaction_debt_adjustments
WITH (security_invoker = true) AS
SELECT
  tp.transaction_id,
  SUM(tp.share_amount) AS debt_amount
FROM public.transaction_persons tp
JOIN public.persons p ON p.id = tp.person_id AND p.is_self = false
JOIN public.transactions t ON t.id = tp.transaction_id AND t.split_nature = 'debt'
GROUP BY tp.transaction_id;

-- ============================================================================
-- VUE : person_balances — cumul dette / cadeau / remboursé / restant par personne.
-- ============================================================================
CREATE OR REPLACE VIEW public.person_balances
WITH (security_invoker = true) AS
SELECT
  p.id AS person_id,
  p.name,
  p.is_self,
  p.color,
  p.is_archived,
  COALESCE(SUM(tp.share_amount) FILTER (WHERE t.split_nature = 'debt'), 0) AS total_debt,
  COALESCE(SUM(tp.share_amount) FILTER (WHERE t.split_nature = 'gift'), 0) AS total_gift,
  COALESCE(rep.total_repaid, 0) AS total_repaid,
  COALESCE(SUM(tp.share_amount) FILTER (WHERE t.split_nature = 'debt'), 0) - COALESCE(rep.total_repaid, 0) AS outstanding_debt
FROM public.persons p
LEFT JOIN public.transaction_persons tp ON tp.person_id = p.id AND p.is_self = false
LEFT JOIN public.transactions t ON t.id = tp.transaction_id
LEFT JOIN (
  SELECT person_id, SUM(amount) AS total_repaid
  FROM public.person_repayments
  GROUP BY person_id
) rep ON rep.person_id = p.id
GROUP BY p.id, p.name, p.is_self, p.color, p.is_archived, rep.total_repaid;

-- ============================================================================
-- VUE : monthly_summary — déduit les parts "dette" et exclut les remboursements.
-- ============================================================================
CREATE OR REPLACE VIEW public.monthly_summary
WITH (security_invoker = true) AS
SELECT
  date_trunc('month', t.operation_date)::date AS month,
  ct.id AS category_type_id,
  ct.name AS category_type_name,
  ct.is_income,
  c.id AS category_id,
  c.name AS category_name,
  s.id AS subcategory_id,
  s.name AS subcategory_name,
  SUM(t.amount + COALESCE(adj.debt_amount, 0)) AS total_amount,
  COUNT(*) AS transaction_count
FROM public.transactions t
JOIN public.subcategories s ON s.id = t.subcategory_id
JOIN public.categories c ON c.id = s.category_id
JOIN public.category_types ct ON ct.id = c.category_type_id
LEFT JOIN public.transaction_debt_adjustments adj ON adj.transaction_id = t.id
WHERE t.status = 'validated'
  AND NOT EXISTS (SELECT 1 FROM public.person_repayments pr WHERE pr.transaction_id = t.id)
GROUP BY 1,2,3,4,5,6,7,8;

-- ============================================================================
-- REALTIME
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='persons') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.persons;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='transaction_persons') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_persons;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='person_repayments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.person_repayments;
  END IF;
END $$;
