-- Enseignes : localisation (pays ou « en ligne »).
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;

-- Achats récurrents (abonnements, loyers, paiements récurrents). `recurrence_end`
-- NULL = sans fin (abonnement). Les mensualités concrètes restent dans
-- purchase_installments, générées jusqu'à un horizon glissant.
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS recurrence_amount numeric(14,2);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS recurrence_start date;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS recurrence_end date;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS recurrence_label text;
