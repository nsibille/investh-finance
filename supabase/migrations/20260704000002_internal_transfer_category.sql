-- Catégorie spéciale pour les virements internes (détectés automatiquement).
INSERT INTO public.category_types (name, slug, sort_order, is_income, color)
VALUES ('Virements', 'virements', 60, false, '#64748B')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (category_type_id, name, sort_order)
SELECT ct.id, 'Virement interne', 10
FROM public.category_types ct
WHERE ct.slug = 'virements'
ON CONFLICT (category_type_id, name) DO NOTHING;

INSERT INTO public.subcategories (category_id, name, sort_order)
SELECT c.id, '—', 0
FROM public.categories c
JOIN public.category_types t ON t.id = c.category_type_id
WHERE t.slug = 'virements' AND c.name = 'Virement interne'
ON CONFLICT (category_id, name) DO NOTHING;
