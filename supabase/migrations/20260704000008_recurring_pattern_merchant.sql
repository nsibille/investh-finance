-- Une opération récurrente peut être rattachée à une enseigne : au match
-- (import), la transaction reçoit aussi cette enseigne.
ALTER TABLE public.recurring_patterns
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_merchant ON public.recurring_patterns(merchant_id);
