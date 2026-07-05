-- Groupes d'achats : un achat peut être rattaché à un achat parent (« groupe »).
-- Permet de budgéter un ensemble (voyage, projet de travaux…) en agrégeant les
-- sous-achats et les transactions rattachées. N'importe quel achat peut devenir
-- un groupe dès qu'il a au moins un enfant. Interdit l'auto-référence et les
-- références circulaires.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL;

-- Un achat ne peut pas être son propre parent.
DO $$ BEGIN
  ALTER TABLE public.purchases
    ADD CONSTRAINT purchases_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_parent ON public.purchases(parent_id);

-- Empêche les cycles de rattachement (A→B→A) en remontant la chaîne des parents
-- avant chaque INSERT/UPDATE de parent_id.
CREATE OR REPLACE FUNCTION public.purchases_prevent_cycle()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cur uuid := NEW.parent_id;
  hops int := 0;
BEGIN
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'Référence circulaire interdite entre achats (id %).', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
    hops := hops + 1;
    IF hops > 1000 THEN
      RAISE EXCEPTION 'Chaîne de groupes d''achats trop profonde (cycle probable).'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_id INTO cur FROM public.purchases WHERE id = cur;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchases_prevent_cycle ON public.purchases;
CREATE TRIGGER trg_purchases_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.purchases_prevent_cycle();
