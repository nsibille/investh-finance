-- Concept « Achat » : regroupe une ou plusieurs transactions sous un même
-- achat (nom, description, catégorie héritée) + mensualités prévisionnelles.
CREATE TABLE IF NOT EXISTS public.purchases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description    text,
  subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_subcategory ON public.purchases(subcategory_id);
DROP TRIGGER IF EXISTS trg_purchases_updated_at ON public.purchases;
CREATE TRIGGER trg_purchases_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_select ON public.purchases FOR SELECT USING (public.is_owner());
CREATE POLICY purchases_insert ON public.purchases FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY purchases_update ON public.purchases FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY purchases_delete ON public.purchases FOR DELETE USING (public.is_owner());

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_purchase ON public.transactions(purchase_id);

CREATE TABLE IF NOT EXISTS public.purchase_installments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  month       date NOT NULL,
  amount      numeric(14,2) NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_installments_purchase ON public.purchase_installments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_installments_month ON public.purchase_installments(month);

ALTER TABLE public.purchase_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_installments_select ON public.purchase_installments FOR SELECT USING (public.is_owner());
CREATE POLICY purchase_installments_insert ON public.purchase_installments FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY purchase_installments_update ON public.purchase_installments FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY purchase_installments_delete ON public.purchase_installments FOR DELETE USING (public.is_owner());
