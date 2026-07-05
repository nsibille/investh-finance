-- Catégorie « Débit différé » sous le type « Virements » (exclu de la compta) :
-- les débits différés consolident des opérations carte déjà comptées.
INSERT INTO public.categories (category_type_id, name, sort_order)
SELECT ct.id, 'Débit différé', 20
FROM public.category_types ct
WHERE ct.slug = 'virements'
ON CONFLICT (category_type_id, name) DO NOTHING;

INSERT INTO public.subcategories (category_id, name, sort_order)
SELECT c.id, '—', 0
FROM public.categories c
JOIN public.category_types t ON t.id = c.category_type_id
WHERE t.slug = 'virements' AND c.name = 'Débit différé'
ON CONFLICT (category_id, name) DO NOTHING;
