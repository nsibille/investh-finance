-- Garantit qu'une catégorie a toujours une sous-catégorie « — » par défaut,
-- afin que la catégorie parente soit toujours sélectionnable dans les pickers
-- (le picker mappe « sélectionner la catégorie » → sa sous-catégorie « — »).
INSERT INTO public.subcategories (category_id, name, sort_order)
SELECT c.id, '—', 0
FROM public.categories c
WHERE NOT EXISTS (
  SELECT 1 FROM public.subcategories s
  WHERE s.category_id = c.id AND s.name = '—'
)
ON CONFLICT (category_id, name) DO NOTHING;
