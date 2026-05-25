# Lyra — Finances personnelles

> App perso de gestion de finances : import multi-banques (CSV/Excel), catégorisation automatique par règles regex auto-apprenantes, dashboards mensuels et analytiques, suivi multi-comptes (courant, livret, PEL, joint…).

App mono-utilisateur, accessible uniquement par l'email Google whitelisté (sécurisé via RLS Supabase).

---

## Stack

- **Framework** : Next.js 15 (App Router) + TypeScript
- **DB & Auth** : Supabase (Postgres + Auth Google OAuth + Realtime + Storage)
- **UI** : Tailwind CSS v4 + tokens CSS custom (design system token-based, voir `DESIGN_SYSTEM.md`)
- **State** : TanStack Query v5 (serveur) + Zustand (client UI)
- **Forms** : React Hook Form + Zod
- **CSV / Excel** : PapaParse + SheetJS
- **Charts** : Recharts
- **Tables** : TanStack Table v8
- **Dates** : date-fns (locale fr)
- **Icons** : Lucide React
- **Tests** : Vitest
- **Hébergement** : Vercel

---

## Prérequis

- **Node.js** ≥ 20
- Un compte **Supabase** (projet déjà créé : `uujmbqwbnztfxuzhnjwp`)
- Un compte **Google Cloud** pour configurer OAuth (Client ID + Secret à mettre dans Supabase Auth Providers)
- Un **PAT Supabase** (Personal Access Token, à créer sur https://supabase.com/dashboard/account/tokens)
- **Claude Code** installé (https://docs.claude.com/claude-code)

---

## Setup en 5 étapes

```bash
# 1. Cloner le repo
git clone https://github.com/nsibille/investh-finance.git
cd investh-finance

# 2. Créer le fichier MCP local (NE PAS le committer)
cp .mcp.json.example .mcp.json
#    puis éditer .mcp.json et remplacer REMPLACER_PAR_TON_PAT_SUPABASE par ton PAT

# 3. Le .env.local sera généré automatiquement par Claude Code via le MCP Supabase
#    (étape 1 du fichier CLAUDE_CODE_PROMPT.md). Sinon, copier .env.local.example si présent.

# 4. Installer les dépendances (Claude Code le fera s'il bootstrap le projet)
npm install

# 5. Lancer le serveur de dev
npm run dev
```

Ouvre http://localhost:3000

---

## Structure des dossiers (après bootstrap)

```
investh-finance/
├── CLAUDE.md                 # lu par Claude Code à chaque session
├── CLAUDE_CODE_PROMPT.md     # specs complètes du projet
├── DESIGN_SYSTEM.md          # tokens + composants UI (source de vérité)
├── README.md                 # ce fichier
├── .mcp.json.example         # template config MCP Supabase
├── .mcp.json                 # config locale (NON committée)
├── .env.local                # secrets locaux (NON committés, auto-générés via MCP)
├── supabase/migrations/      # versionning des migrations SQL
└── src/
    ├── app/                  # pages Next.js App Router
    ├── components/           # UI (ui/, layout/, dashboard/, transactions/, ...)
    ├── lib/                  # logique métier (parsers, rules, recurring, analytics)
    ├── server/actions/       # Server Actions Next.js (mutations)
    ├── hooks/                # hooks custom (useRealtime, useToast)
    ├── stores/               # Zustand stores
    └── types/                # types TS (database.types.ts auto-généré)
```

---

## Documentation interne

- **Démarrer le projet avec Claude Code** : lire `CLAUDE.md` puis `CLAUDE_CODE_PROMPT.md` (étape 0 : MCP + DB).
- **Créer un composant UI** : consulter d'abord l'index des slugs dans `DESIGN_SYSTEM.md`. Réutiliser un slug existant si possible, sinon créer + documenter avant d'implémenter.

---

## Contribuer (règle des slugs résumée en 3 lignes)

1. Avant tout composant : ouvrir `DESIGN_SYSTEM.md` et chercher dans l'**index des slugs**.
2. Slug existant → réutiliser tel quel. Slug proche → créer `[slug]-[variante]`. Inexistant → créer + documenter (section + index).
3. Tous les tokens (couleur, typo, espacement, ombre) viennent des **variables CSS**. Aucun hex hardcodé dans un composant.

---

## Sécurité

- App mono-utilisateur, accessible uniquement par l'email Google whitelisté dans la fonction SQL `is_owner()`.
- RLS activée sur 100% des tables (vérifier via `get_advisors` après chaque migration).
- `.env.local` et `.mcp.json` dans `.gitignore` — aucun secret committé.
- La clé `anon` Supabase est publique par design (utilisable côté client, protégée par RLS). La `service_role` key n'est jamais exposée.

---

## Licence

Projet privé personnel. Tous droits réservés.
