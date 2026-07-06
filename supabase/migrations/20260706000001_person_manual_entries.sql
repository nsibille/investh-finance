-- ============================================================================
-- PERSON MANUAL ENTRIES — dettes / cadeaux « manuels » d'une personne, sans
-- ligne bancaire (prêt en espèces, cadeau hors compte…). Complète les
-- ventilations de transactions (transaction_persons) et les remboursements.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.person_manual_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id  uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  nature     split_nature NOT NULL,               -- 'debt' = créance, 'gift' = cadeau
  amount     numeric(14,2) NOT NULL CHECK (amount > 0),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  label      text CHECK (label IS NULL OR length(label) <= 200),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_person_manual_entries_person ON public.person_manual_entries(person_id);
DROP TRIGGER IF EXISTS trg_person_manual_entries_updated_at ON public.person_manual_entries;
CREATE TRIGGER trg_person_manual_entries_updated_at BEFORE UPDATE ON public.person_manual_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.person_manual_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_manual_entries_select ON public.person_manual_entries FOR SELECT USING (public.is_owner());
CREATE POLICY person_manual_entries_insert ON public.person_manual_entries FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY person_manual_entries_update ON public.person_manual_entries FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY person_manual_entries_delete ON public.person_manual_entries FOR DELETE USING (public.is_owner());

-- ============================================================================
-- VUE : person_balances — intègre désormais les entrées manuelles (dette/cadeau)
--        en plus des parts de transactions et des remboursements.
-- ============================================================================
CREATE OR REPLACE VIEW public.person_balances
WITH (security_invoker = true) AS
SELECT
  p.id AS person_id,
  p.name,
  p.is_self,
  p.color,
  p.is_archived,
  (COALESCE(tx.debt, 0) + COALESCE(man.debt, 0)) AS total_debt,
  (COALESCE(tx.gift, 0) + COALESCE(man.gift, 0)) AS total_gift,
  COALESCE(rep.total_repaid, 0) AS total_repaid,
  (COALESCE(tx.debt, 0) + COALESCE(man.debt, 0) - COALESCE(rep.total_repaid, 0)) AS outstanding_debt
FROM public.persons p
LEFT JOIN (
  SELECT
    tp.person_id,
    SUM(tp.share_amount) FILTER (WHERE t.split_nature = 'debt') AS debt,
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

-- ============================================================================
-- REALTIME
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='person_manual_entries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.person_manual_entries;
  END IF;
END $$;
