-- Réconciliation des virements internes.
-- Chaque virement interne est une paire (sortie / entrée) sur deux comptes.
-- `transfer_group_id` relie les deux jambes d'une même paire ; le total d'un
-- groupe doit toujours faire 0. Les lignes « Virement interne » sans groupe
-- (ou groupe déséquilibré) sont des orphelins à réconcilier manuellement.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group
  ON public.transactions(transfer_group_id);

-- Backfill : apparie gloutonnement les virements internes existants
-- (montants opposés, deux comptes distincts, ≤ 5 jours d'écart, au plus proche).
DO $$
DECLARE
  sub_id uuid;
  neg RECORD;
  pos_id uuid;
  gid uuid;
BEGIN
  SELECT s.id INTO sub_id
  FROM public.subcategories s
  JOIN public.categories c ON c.id = s.category_id
  WHERE c.name = 'Virement interne'
  LIMIT 1;
  IF sub_id IS NULL THEN RETURN; END IF;

  FOR neg IN
    SELECT id, account_id, amount, operation_date
    FROM public.transactions
    WHERE subcategory_id = sub_id AND amount < 0 AND transfer_group_id IS NULL
    ORDER BY operation_date, id
  LOOP
    SELECT p.id INTO pos_id
    FROM public.transactions p
    WHERE p.subcategory_id = sub_id
      AND p.amount = -neg.amount
      AND p.account_id <> neg.account_id
      AND p.transfer_group_id IS NULL
      AND abs(p.operation_date - neg.operation_date) <= 5
    ORDER BY abs(p.operation_date - neg.operation_date), p.operation_date, p.id
    LIMIT 1;

    IF pos_id IS NOT NULL THEN
      gid := gen_random_uuid();
      UPDATE public.transactions
      SET transfer_group_id = gid
      WHERE id IN (neg.id, pos_id);
    END IF;
  END LOOP;
END $$;
