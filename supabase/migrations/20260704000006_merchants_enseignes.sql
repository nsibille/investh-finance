-- Concept « Enseigne » : nom commercial + catégorie par défaut + règles rattachées.
-- Une transaction ou un achat peut être rattaché à une enseigne : la catégorie
-- par défaut de l'enseigne est appliquée, mais reste surchargeable.
CREATE TABLE IF NOT EXISTS public.merchants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_name_lower ON public.merchants (lower(name));
CREATE INDEX IF NOT EXISTS idx_merchants_subcategory ON public.merchants(subcategory_id);
DROP TRIGGER IF EXISTS trg_merchants_updated_at ON public.merchants;
CREATE TRIGGER trg_merchants_updated_at BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY merchants_select ON public.merchants FOR SELECT USING (public.is_owner());
CREATE POLICY merchants_insert ON public.merchants FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY merchants_update ON public.merchants FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY merchants_delete ON public.merchants FOR DELETE USING (public.is_owner());

-- Rattachement enseigne (ON DELETE SET NULL : supprimer l'enseigne détache).
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON public.transactions(merchant_id);

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_merchant ON public.purchases(merchant_id);

ALTER TABLE public.categorization_rules
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rules_merchant ON public.categorization_rules(merchant_id);
