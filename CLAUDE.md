# Lyra — Finances personnelles

App perso de consolidation multi-comptes, catégorisation auto par règles regex, dashboard mensuel. Mono-utilisateur (super admin via whitelist Google OAuth).

## À LIRE EN PREMIER À CHAQUE SESSION
1. `CLAUDE_CODE_PROMPT.md` — specs complètes (DB, features, archi, ordre d'implémentation)
2. `DESIGN_SYSTEM.md` — tokens, composants, slugs (CONSULTER L'INDEX AVANT CHAQUE UI)

## Règles non négociables
1. **Stack** : Next.js 15 App Router + TypeScript + Tailwind v4 + Supabase. Aucune autre dépendance UI (pas de shadcn, pas de MUI).
2. **Police** : Geist (UI) + Geist Mono (montants). Jamais d'autre font.
3. **Primaire** : `--color-brand-primary` (indigo `#5B5BD6`). Jamais de hex hardcodé dans un composant.
4. **DB & types** : SQL via MCP Supabase uniquement, types TS générés depuis le schéma réel (`src/types/database.types.ts`).
5. **RLS** : activée sur 100% des tables, whitelist email Google. Vérifier via `get_advisors` après chaque migration.

## Règle design system
Avant CHAQUE composant UI : ouvrir `DESIGN_SYSTEM.md` → consulter l'index des slugs. Existant → réutiliser. Proche → variante `[slug]-[variante]`. Inexistant → créer + documenter (section + index) + implémenter.

## Connexion Supabase
Voir `.mcp.json` (créé localement depuis `.mcp.json.example`, jamais committé). Toutes les opérations DB passent par le MCP.
