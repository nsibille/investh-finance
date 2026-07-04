-- Achat archivé (masqué de la liste primaire).
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_purchases_archived ON public.purchases(is_archived);

-- Appariement mensualité ⇆ transaction + libellé attendu pour l'auto-matching.
ALTER TABLE public.purchase_installments
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_installments
  ADD COLUMN IF NOT EXISTS label text;
CREATE INDEX IF NOT EXISTS idx_purchase_installments_transaction ON public.purchase_installments(transaction_id);
