-- Une récurrente peut accepter plusieurs montants attendus (les prix d'abonnement
-- changent). `expected_amount` reste le montant principal (affichage).
ALTER TABLE public.recurring_patterns
  ADD COLUMN IF NOT EXISTS expected_amounts numeric(14,2)[];
-- Initialise le tableau depuis le montant unique existant.
UPDATE public.recurring_patterns
  SET expected_amounts = ARRAY[expected_amount]
  WHERE expected_amount IS NOT NULL
    AND (expected_amounts IS NULL OR array_length(expected_amounts, 1) IS NULL);
