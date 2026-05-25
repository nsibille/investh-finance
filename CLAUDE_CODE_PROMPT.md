# Lyra — Specs complètes

> Référence principale pour Claude Code. Lire `CLAUDE.md` puis ce fichier, puis `DESIGN_SYSTEM.md`.

---

## 1. Contexte

### Pitch
**Lyra** est une application web de gestion de finances personnelles mono-utilisateur. Elle remplace un suivi Excel manuel par un outil qui :
- importe automatiquement les relevés CSV/Excel de plusieurs banques,
- catégorise les transactions via un moteur de règles regex auto-apprenant,
- consolide la vue patrimoniale (multi-comptes : courant, livret, PEL, joint…),
- produit des dashboards mensuels et analytiques pour piloter le budget.

### Utilisateur
- **Un seul utilisateur (le propriétaire)**, identifié par son email Google.
- Whitelist au niveau RLS : seul l'email autorisé peut accéder aux données.
- Pas de notion de rôle interne (super admin de facto).

### Périmètre V1
Fait : import multi-banques, catégorisation auto+manuelle, dashboard mensuel + analytique, gestion comptes, tags, notes, récurrentes, doublons, export, recherche, realtime.

Hors V1 (mais DB préparée) : budget projeté vs réel, simulations futures à partir d'hypothèses.

---

## 2. Direction artistique

### Ambiance
Minimaliste pro façon FinSage / Linear / Stripe, avec touches colorées dosées. Background blanc cassé avec subtils dégradés "aurora" (rose/violet/bleu pâle) dans le hero du dashboard. Densité compacte mais respirable. Typo géométrique tight. Couleur primaire indigo. Couleurs sémantiques claires (vert revenus, rouge dépenses, bleu neutre, orange alerte). Light only V1 mais tokens dark préparés pour V2.

### Typographie
- **Geist Sans** (UI) : graisses 400/500/600/700, via le package `geist` (npm).
- **Geist Mono** (montants tabulaires) : essentiel pour aligner les chiffres.
- Fallback : `system-ui, -apple-system, sans-serif`.

### Palette
- **Primaire** : Indigo `#5B5BD6` (déclinaisons 50→900).
- **Sémantique** : success `#10B981`, danger `#EF4444`, warning `#F59E0B`, info `#3B82F6`.
- **Neutres** : gris froids Zinc (`#FAFAFA` → `#0A0A0B`).
- **Fonds** : surface `#FFFFFF`, page `#FAFAFA`, subtle `#F4F4F5`.

### Style signature
- **Boutons** : rectangulaires, coins légèrement arrondis (`--radius-md` = 8px), pas de pill.
- **Cards** : `border-radius` 12px, ombre subtile, bordure 1px.
- **Décoratifs** : dégradés aurora multicolores flous dans le hero dashboard uniquement.
- **Densité** : compacte (rows tableaux 36px), respirable sur les vues KPI.

---

## 3. Règle design system (NON NÉGOCIABLE)

Avant chaque composant UI :

1. Ouvrir `DESIGN_SYSTEM.md`, consulter l'index des slugs.
2. Slug existant → réutiliser **sans aucune modification**.
3. Slug proche → créer une variante `[slug-existant]-[variante]`.
4. Slug inexistant → **créer + documenter (section + index) + implémenter**.
5. Valable pour chaque composant, chaque variante, chaque état (default, hover, focus, active, disabled, loading, error, empty).

---

## 4. Connexion Supabase via MCP

### Étape 0 — Vérifier la connexion MCP
- `list_organizations` doit retourner ≥ 1 org
- `list_projects` doit contenir le projet `uujmbqwbnztfxuzhnjwp`
- Si KO : demander à l'utilisateur de vérifier `.mcp.json` (PAT valide ? project_ref correct ?).

### Étape 1 — Récupérer URL + clé anon → écrire `.env.local`
- `get_project_url` → `NEXT_PUBLIC_SUPABASE_URL`
- `get_publishable_keys` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Écrire automatiquement le fichier `.env.local`. **Ne jamais committer** (dans `.gitignore`).

### Étape 2 — Appliquer le schéma SQL
- Utiliser `execute_sql` pour exécuter le bloc SQL de la section 6.
- Créer `supabase/migrations/00000000000000_initial_schema.sql` avec le même contenu pour versionner.
- Idempotent : `CREATE … IF NOT EXISTS` partout.

### Étape 3 — Vérifier les RLS
- `get_advisors` → AUCUN advisor de niveau ERROR.
- Si "RLS disabled" : corriger immédiatement.

### Étape 4 — Générer les types TypeScript
- `generate_typescript_types` → écrire le résultat dans `src/types/database.types.ts`.
- À regénérer après chaque migration.

---

## 5. Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js 15 (App Router) | Standard absolu, déploiement Vercel 1-clic, Server Actions, Server Components |
| Langage | TypeScript 5.x strict | Typage essentiel pour montants financiers, types DB auto-générés |
| Auth | Supabase Auth (Google OAuth) | 1-clic, pas de mot de passe, sécurisé via whitelist RLS |
| DB | Supabase Postgres 15+ | RLS native |
| Realtime | Supabase Realtime | Channels sur transactions/accounts/imports/rules |
| Storage | Supabase Storage | Archivage CSV importés + justificatifs |
| Styles | Tailwind CSS v4 + tokens CSS | Parfait pour design system token-based |
| Composants | Custom (zéro lib externe) | Cohérence design system, slugs maîtrisés |
| State serveur | TanStack Query v5 | Cache, refetch, mutations optimistes |
| State client | Zustand | UI globale uniquement (modals, filtres) |
| Forms | React Hook Form + Zod | Validation typée, valide aussi les CSV |
| CSV | PapaParse | Streaming, robuste, standard |
| Excel | SheetJS (`xlsx`) | Standard .xlsx |
| Charts | Recharts | Déclaratif, parfait pour dashboards |
| Tables | TanStack Table v8 | Tri/filtre/pagination/virtualisation |
| Dates | date-fns + locale `fr` | Léger, modulaire |
| Icons | Lucide React | Catalogue large, cohérent |
| Tests | Vitest | Parsers, règles, calculs |
| Lint/Format | ESLint + Prettier | Configs Next standard |
| Hébergement | Vercel | Déploiement auto sur push GitHub |

**Pattern d'archi** :
- **Server Components** par défaut pour pages de lecture.
- **Server Actions** pour toutes les mutations.
- **Client Components** uniquement pour interactivité (forms, filtres, charts).
- **Realtime** côté client via hook custom `useRealtime(table)`.

---

## 6. Schéma de base de données

SQL complet exécutable via `execute_sql`. Idempotent. RLS activée sur 100% des tables.

```sql
-- ============================================================================
-- LYRA — INITIAL SCHEMA
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- WHITELIST EMAIL — helper RLS
-- ============================================================================
-- IMPORTANT : remplacer 'TON_EMAIL@gmail.com' par l'email Google whitelisté.
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() ->> 'email' = 'TON_EMAIL@gmail.com'
$$;

-- ============================================================================
-- TRIGGER updated_at générique
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================================
-- ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('checking','savings','pel','joint','investment','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending','validated','ignored');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE import_status AS ENUM ('processing','completed','failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rule_match_type AS ENUM ('regex','exact','contains');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- TABLE : accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  type            account_type NOT NULL DEFAULT 'checking',
  bank            text,
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  initial_date    date NOT NULL DEFAULT CURRENT_DATE,
  currency        text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  color           text DEFAULT '#5B5BD6',
  is_archived     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounts_archived ON public.accounts(is_archived);
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_select ON public.accounts FOR SELECT USING (public.is_owner());
CREATE POLICY accounts_insert ON public.accounts FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY accounts_update ON public.accounts FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY accounts_delete ON public.accounts FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : category_types
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.category_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 60),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  sort_order  smallint NOT NULL DEFAULT 0,
  is_income   boolean NOT NULL DEFAULT false,
  color       text NOT NULL DEFAULT '#71717A',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_category_types_sort ON public.category_types(sort_order);
DROP TRIGGER IF EXISTS trg_category_types_updated_at ON public.category_types;
CREATE TRIGGER trg_category_types_updated_at BEFORE UPDATE ON public.category_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.category_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_types_select ON public.category_types FOR SELECT USING (public.is_owner());
CREATE POLICY category_types_insert ON public.category_types FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY category_types_update ON public.category_types FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY category_types_delete ON public.category_types FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type_id  uuid NOT NULL REFERENCES public.category_types(id) ON DELETE RESTRICT,
  name              text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  icon              text,
  color             text,
  sort_order        smallint NOT NULL DEFAULT 0,
  is_archived       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_type_id, name)
);
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories(category_type_id);
CREATE INDEX IF NOT EXISTS idx_categories_archived ON public.categories(is_archived);
DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_select ON public.categories FOR SELECT USING (public.is_owner());
CREATE POLICY categories_insert ON public.categories FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY categories_update ON public.categories FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY categories_delete ON public.categories FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : subcategories
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subcategories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  sort_order   smallint NOT NULL DEFAULT 0,
  is_archived  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON public.subcategories(category_id);
DROP TRIGGER IF EXISTS trg_subcategories_updated_at ON public.subcategories;
CREATE TRIGGER trg_subcategories_updated_at BEFORE UPDATE ON public.subcategories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY subcategories_select ON public.subcategories FOR SELECT USING (public.is_owner());
CREATE POLICY subcategories_insert ON public.subcategories FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY subcategories_update ON public.subcategories FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY subcategories_delete ON public.subcategories FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 60),
  color       text NOT NULL DEFAULT '#5B5BD6',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_tags_updated_at ON public.tags;
CREATE TRIGGER trg_tags_updated_at BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_select ON public.tags FOR SELECT USING (public.is_owner());
CREATE POLICY tags_insert ON public.tags FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY tags_update ON public.tags FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY tags_delete ON public.tags FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : imports
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.imports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  source_filename     text NOT NULL,
  source_storage_path text,
  bank_format         text,
  status              import_status NOT NULL DEFAULT 'processing',
  rows_total          integer NOT NULL DEFAULT 0,
  rows_imported       integer NOT NULL DEFAULT 0,
  rows_duplicates     integer NOT NULL DEFAULT 0,
  error_message       text,
  imported_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_imports_account ON public.imports(account_id);
CREATE INDEX IF NOT EXISTS idx_imports_status ON public.imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_imported_at ON public.imports(imported_at DESC);
DROP TRIGGER IF EXISTS trg_imports_updated_at ON public.imports;
CREATE TRIGGER trg_imports_updated_at BEFORE UPDATE ON public.imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY imports_select ON public.imports FOR SELECT USING (public.is_owner());
CREATE POLICY imports_insert ON public.imports FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY imports_update ON public.imports FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY imports_delete ON public.imports FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : transactions (coeur de l'app)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  import_id         uuid REFERENCES public.imports(id) ON DELETE SET NULL,
  subcategory_id    uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  applied_rule_id   uuid,
  operation_date    date NOT NULL,
  value_date        date,
  label             text NOT NULL CHECK (length(label) BETWEEN 1 AND 500),
  raw_label         text NOT NULL,
  amount            numeric(14,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  status            transaction_status NOT NULL DEFAULT 'pending',
  is_recurring      boolean NOT NULL DEFAULT false,
  recurring_pattern_id uuid,
  note              text,
  dedup_hash        text NOT NULL,
  search_vector     tsvector GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(label, '') || ' ' || coalesce(raw_label, '') || ' ' || coalesce(note, ''))
  ) STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  validated_at      timestamptz,
  UNIQUE (account_id, dedup_hash)
);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_import ON public.transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subcategory ON public.transactions(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_operation_date ON public.transactions(operation_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_month ON public.transactions(date_trunc('month', operation_date));
CREATE INDEX IF NOT EXISTS idx_transactions_search ON public.transactions USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_transactions_label_trgm ON public.transactions USING GIN (raw_label gin_trgm_ops);
DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_select ON public.transactions FOR SELECT USING (public.is_owner());
CREATE POLICY transactions_insert ON public.transactions FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY transactions_update ON public.transactions FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY transactions_delete ON public.transactions FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : transaction_tags (jointure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transaction_tags (
  transaction_id  uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id          uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag ON public.transaction_tags(tag_id);

ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_tags_select ON public.transaction_tags FOR SELECT USING (public.is_owner());
CREATE POLICY transaction_tags_insert ON public.transaction_tags FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY transaction_tags_delete ON public.transaction_tags FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : categorization_rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  match_type        rule_match_type NOT NULL DEFAULT 'regex',
  pattern           text NOT NULL,
  case_sensitive    boolean NOT NULL DEFAULT false,
  amount_min        numeric(14,2),
  amount_max        numeric(14,2),
  account_id        uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  subcategory_id    uuid NOT NULL REFERENCES public.subcategories(id) ON DELETE CASCADE,
  auto_validate     boolean NOT NULL DEFAULT true,
  priority          smallint NOT NULL DEFAULT 100,
  is_active         boolean NOT NULL DEFAULT true,
  hit_count         integer NOT NULL DEFAULT 0,
  last_hit_at       timestamptz,
  created_from_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON public.categorization_rules(priority, is_active);
CREATE INDEX IF NOT EXISTS idx_rules_subcategory ON public.categorization_rules(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_rules_account ON public.categorization_rules(account_id);
DROP TRIGGER IF EXISTS trg_rules_updated_at ON public.categorization_rules;
CREATE TRIGGER trg_rules_updated_at BEFORE UPDATE ON public.categorization_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY rules_select ON public.categorization_rules FOR SELECT USING (public.is_owner());
CREATE POLICY rules_insert ON public.categorization_rules FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY rules_update ON public.categorization_rules FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY rules_delete ON public.categorization_rules FOR DELETE USING (public.is_owner());

-- FK différée : transactions.applied_rule_id
DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT fk_transactions_applied_rule
    FOREIGN KEY (applied_rule_id) REFERENCES public.categorization_rules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- TABLE : recurring_patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recurring_patterns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  account_id          uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  subcategory_id      uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  expected_amount     numeric(14,2),
  amount_tolerance    numeric(5,2) NOT NULL DEFAULT 5.00,
  expected_day        smallint CHECK (expected_day BETWEEN 1 AND 31),
  frequency_days      smallint NOT NULL DEFAULT 30,
  label_pattern       text,
  is_active           boolean NOT NULL DEFAULT true,
  last_seen_at        date,
  alert_if_missing    boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recurring_account ON public.recurring_patterns(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON public.recurring_patterns(is_active);
DROP TRIGGER IF EXISTS trg_recurring_updated_at ON public.recurring_patterns;
CREATE TRIGGER trg_recurring_updated_at BEFORE UPDATE ON public.recurring_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recurring_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY recurring_select ON public.recurring_patterns FOR SELECT USING (public.is_owner());
CREATE POLICY recurring_insert ON public.recurring_patterns FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY recurring_update ON public.recurring_patterns FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY recurring_delete ON public.recurring_patterns FOR DELETE USING (public.is_owner());

-- FK différée : transactions.recurring_pattern_id
DO $$ BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT fk_transactions_recurring_pattern
    FOREIGN KEY (recurring_pattern_id) REFERENCES public.recurring_patterns(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- TABLE : attachments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  filename        text NOT NULL,
  mime_type       text,
  size_bytes      integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_transaction ON public.attachments(transaction_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY attachments_select ON public.attachments FOR SELECT USING (public.is_owner());
CREATE POLICY attachments_insert ON public.attachments FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY attachments_delete ON public.attachments FOR DELETE USING (public.is_owner());

-- ============================================================================
-- TABLE : budgets (préparée pour V2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  subcategory_id   uuid REFERENCES public.subcategories(id) ON DELETE CASCADE,
  month            date NOT NULL,
  projected_amount numeric(14,2) NOT NULL DEFAULT 0,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((category_id IS NOT NULL) OR (subcategory_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_budgets_month ON public.budgets(month);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON public.budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_subcategory ON public.budgets(subcategory_id);
DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY budgets_select ON public.budgets FOR SELECT USING (public.is_owner());
CREATE POLICY budgets_insert ON public.budgets FOR INSERT WITH CHECK (public.is_owner());
CREATE POLICY budgets_update ON public.budgets FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY budgets_delete ON public.budgets FOR DELETE USING (public.is_owner());

-- ============================================================================
-- SEED : catégories inspirées de l'Excel utilisateur
-- ============================================================================
INSERT INTO public.category_types (name, slug, sort_order, is_income, color) VALUES
  ('Revenus',         'revenus',          10, true,  '#10B981'),
  ('Prélèvements',    'prelevements',     20, false, '#71717A'),
  ('Frais Fixes',     'frais-fixes',      30, false, '#F59E0B'),
  ('Frais Variables', 'frais-variables',  40, false, '#8B5CF6'),
  ('Investissements', 'investissements',  50, false, '#3B82F6')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (category_type_id, name, sort_order)
SELECT ct.id, v.name, v.sort
FROM public.category_types ct,
     (VALUES ('Salaire',10),('Loyers',20),('Auto-entrepreneur',30),('Revenus autres',40)) AS v(name, sort)
WHERE ct.slug = 'revenus'
ON CONFLICT (category_type_id, name) DO NOTHING;

INSERT INTO public.categories (category_type_id, name, sort_order)
SELECT ct.id, v.name, v.sort
FROM public.category_types ct,
     (VALUES ('Impôts revenus',10),('Provision TVA',20),('Provisions charges',30),('TVA',40),('Charges auto-entrepreneur',50)) AS v(name, sort)
WHERE ct.slug = 'prelevements'
ON CONFLICT (category_type_id, name) DO NOTHING;

INSERT INTO public.categories (category_type_id, name, sort_order)
SELECT ct.id, v.name, v.sort
FROM public.category_types ct,
     (VALUES ('Foncier',10),('Ancien Prêt',20),('Énergie',30),('Assurances',40),('Internet',50),('Téléphone',60),('Transports',70),('Taxe Foncière',80)) AS v(name, sort)
WHERE ct.slug = 'frais-fixes'
ON CONFLICT (category_type_id, name) DO NOTHING;

INSERT INTO public.categories (category_type_id, name, sort_order)
SELECT ct.id, v.name, v.sort
FROM public.category_types ct,
     (VALUES ('Cantine',10),('Courses',20),('Appartement',30),('Loisirs',40),('Culture',50),('Soirées',60),('Chauffeur',70),('Restaurants',80),('Cadeaux',90),('Vin',100),('Bien-être',110),('Voyages',120),('Habits',130),('Projets',140),('Frais bancaires',150),('Divers',160)) AS v(name, sort)
WHERE ct.slug = 'frais-variables'
ON CONFLICT (category_type_id, name) DO NOTHING;

INSERT INTO public.categories (category_type_id, name, sort_order)
SELECT ct.id, v.name, v.sort
FROM public.category_types ct,
     (VALUES ('PEL',10),('Livret',20),('PEA',30),('Assurance vie',40),('Autres investissements',50)) AS v(name, sort)
WHERE ct.slug = 'investissements'
ON CONFLICT (category_type_id, name) DO NOTHING;

-- Sous-catégories Foncier (cf. Excel : dont Intérêts, dont RMBT Capital…)
INSERT INTO public.subcategories (category_id, name, sort_order)
SELECT c.id, sub.name, sub.sort
FROM public.categories c
JOIN public.category_types t ON t.id = c.category_type_id
JOIN (VALUES ('Intérêts',10),('RMBT Capital',20),('Charges',30),('Assurance Emprunt',40)) AS sub(name, sort) ON true
WHERE t.slug = 'frais-fixes' AND c.name = 'Foncier'
ON CONFLICT (category_id, name) DO NOTHING;

-- Sous-catégorie "—" par défaut pour chaque catégorie sans sous-cat spécifique
INSERT INTO public.subcategories (category_id, name, sort_order)
SELECT c.id, '—', 0
FROM public.categories c
WHERE NOT EXISTS (SELECT 1 FROM public.subcategories s WHERE s.category_id = c.id)
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================================================
-- VUE : monthly_summary
-- ============================================================================
CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT
  date_trunc('month', t.operation_date)::date AS month,
  ct.id AS category_type_id,
  ct.name AS category_type_name,
  ct.is_income,
  c.id AS category_id,
  c.name AS category_name,
  s.id AS subcategory_id,
  s.name AS subcategory_name,
  SUM(t.amount) AS total_amount,
  COUNT(*) AS transaction_count
FROM public.transactions t
JOIN public.subcategories s ON s.id = t.subcategory_id
JOIN public.categories c ON c.id = s.category_id
JOIN public.category_types ct ON ct.id = c.category_type_id
WHERE t.status = 'validated'
GROUP BY 1,2,3,4,5,6,7,8;

-- ============================================================================
-- VUE : account_balances
-- ============================================================================
CREATE OR REPLACE VIEW public.account_balances AS
SELECT
  a.id AS account_id,
  a.name AS account_name,
  a.type,
  a.currency,
  a.initial_balance,
  COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'validated'), 0) AS transactions_sum,
  a.initial_balance + COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'validated'), 0) AS current_balance,
  COUNT(t.id) FILTER (WHERE t.status = 'pending') AS pending_count
FROM public.accounts a
LEFT JOIN public.transactions t ON t.account_id = a.id
WHERE a.is_archived = false
GROUP BY a.id;

-- ============================================================================
-- REALTIME : publier les tables temps réel
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categorization_rules;
```

> **Action après exécution** : remplacer `'TON_EMAIL@gmail.com'` par l'email Google whitelisté dans `is_owner()`, puis appeler `get_advisors` pour vérifier les RLS.

---

## 7. Architecture fichiers

```
investh-finance/
├── .mcp.json                      # config MCP locale, NON committée
├── .mcp.json.example              # template
├── .env.local                     # secrets locaux (auto-générés via MCP), NON committés
├── .env.local.example             # template
├── .gitignore
├── CLAUDE.md
├── CLAUDE_CODE_PROMPT.md          # ce fichier
├── DESIGN_SYSTEM.md
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── vitest.config.ts
├── supabase/
│   └── migrations/
│       └── 00000000000000_initial_schema.sql   # miroir du SQL exécuté
├── public/
│   ├── logo.svg                   # logo Lyra (Claude Code génère)
│   ├── icon.svg
│   └── favicon.ico
└── src/
    ├── app/
    │   ├── layout.tsx             # root layout + fonts + providers
    │   ├── globals.css            # tokens CSS + base Tailwind
    │   ├── page.tsx               # redirige /dashboard ou /login
    │   ├── login/page.tsx         # bouton Google OAuth
    │   ├── auth/callback/route.ts # callback OAuth
    │   └── (app)/                 # routes authentifiées
    │       ├── layout.tsx         # sidebar + header + check auth + whitelist
    │       ├── dashboard/page.tsx
    │       ├── transactions/
    │       │   ├── page.tsx
    │       │   ├── pending/page.tsx
    │       │   └── [id]/page.tsx
    │       ├── accounts/
    │       │   ├── page.tsx
    │       │   └── [id]/page.tsx
    │       ├── import/page.tsx
    │       ├── categories/page.tsx
    │       ├── rules/page.tsx
    │       ├── recurring/page.tsx
    │       ├── analytics/page.tsx
    │       └── settings/page.tsx
    ├── components/
    │   ├── ui/                    # atomes (slugs btn-*, input-*, badge-*, …)
    │   ├── layout/                # Sidebar, Header, AppShell
    │   ├── dashboard/             # MonthlyHero, KpiCard, CategoryBreakdown, …
    │   ├── transactions/          # Table, Row, Form, PendingValidator, RuleCreatorModal
    │   ├── accounts/              # AccountCard, AccountForm
    │   ├── import/                # FileDropzone, BankSelector, PreviewTable, ImportProgress
    │   ├── categories/            # CategoryTree, CategoryBadge
    │   ├── rules/                 # RulesList, RuleForm
    │   ├── recurring/             # RecurringList, MissingRecurringAlert
    │   └── search/                # GlobalSearch (Cmd+K)
    ├── lib/
    │   ├── supabase/              # client.ts, server.ts, middleware.ts
    │   ├── auth/                  # whitelist.ts, actions.ts
    │   ├── import/
    │   │   ├── parsers/           # index.ts, types.ts, csv-generic.ts, bank-*.ts
    │   │   ├── dedup.ts
    │   │   └── importer.ts
    │   ├── rules/                 # engine.ts, matcher.ts, suggester.ts
    │   ├── recurring/             # detector.ts, checker.ts
    │   ├── analytics/             # monthly.ts, comparisons.ts
    │   ├── export/                # csv.ts, xlsx.ts
    │   ├── format/                # currency.ts, date.ts
    │   └── utils.ts
    ├── server/actions/            # Server Actions Next.js (mutations)
    │   ├── accounts.ts
    │   ├── transactions.ts
    │   ├── imports.ts
    │   ├── rules.ts
    │   ├── recurring.ts
    │   └── categories.ts
    ├── hooks/                     # useRealtime, useDebounce, useToast
    ├── stores/                    # ui.ts (Zustand : filtres, modals)
    ├── types/
    │   ├── database.types.ts      # AUTO-GÉNÉRÉ via MCP
    │   └── app.types.ts           # types métier dérivés
    └── tests/                     # parsers, rules-engine, dedup, recurring
```

---

## 8. Fonctionnalités détaillées

### 8.1 Authentification & whitelist
**Description** : Login Google OAuth via Supabase Auth. Seul l'email whitelisté dans `is_owner()` peut accéder.

**Slugs UI** : page login = `card-surface` + `btn-primary-md` ("Se connecter avec Google") + logo. Erreur whitelist = `alert-danger` + `empty-state`.

**Logique** :
1. Clic Google → OAuth Supabase → callback `/auth/callback`
2. Middleware vérifie session sur toutes les routes `(app)/`
3. Si email ≠ whitelist → logout + `/login?error=unauthorized`

### 8.2 Gestion des comptes
**Description** : CRUD comptes (courant, livret, PEL, joint, investment). Chaque compte a un solde initial à une date donnée, solde courant via vue `account_balances`.

**Slugs UI** : `layout-page-header`, `card-account`, `nav-tabs`, `input-text-md`, `input-select-md`, `input-currency-md`, `input-date-md`.

**Logique** : solde courant = `initial_balance + SUM(transactions.amount WHERE validated)`. Archiver au lieu de supprimer si historique.

**Requêtes** : `select * from account_balances`, CRUD `accounts`.

### 8.3 Import CSV/Excel
**Description** : User sélectionne un compte + uploade un fichier. L'app détecte le format banque, parse, déduplique, applique les règles, propose preview, confirme.

**Slugs UI** : `file-dropzone`, `input-select-md` (compte + format), `table-import-preview`, `badge-status-new`/`badge-status-duplicate`, `progress-bar`.

**Logique** :
1. Upload → Supabase Storage `imports/{account_id}/{timestamp}_{filename}`
2. Création row `imports` status='processing'
3. Parser approprié → `ParsedTransaction[]`
4. Calcul `dedup_hash` = sha256(`account_id|date|amount|label_normalized`)
5. UNIQUE constraint filtre les doublons
6. Pour chaque nouvelle : moteur de règles → status='validated' ou 'pending'
7. Bulk insert
8. Update `imports` status='completed'

### 8.4 Liste transactions + filtres
**Description** : Table filtrable (compte, période, catégorie, statut, montant, tags). Recherche full-text via `tsvector` / `pg_trgm`.

**Slugs UI** : `layout-page-header`, `transaction-filters`, `table-transactions`, `transaction-row`, `badge-category`, `badge-tag-md`, `amount-positive`/`amount-negative`, `badge-status-*`, `btn-icon-md`, `empty-state`, `input-search-md`.

**Logique** : Pagination 50/100/200, tri date desc défaut, filtres dans URL, édition inline catégorie.

### 8.5 Workflow "à valider"
**Description** : Vue dédiée pending. User catégorise. App propose création règle regex depuis libellé brut.

**Slugs UI** : `card-pending-validator` (1 par transaction), `input-category-picker`, `btn-primary-md` (Valider), `btn-ghost-md` (Ignorer), `modal-surface` + `rule-suggestion-form`.

**Logique** :
1. Liste pending tri date
2. User sélectionne sous-catégorie → `update transactions SET subcategory_id, status='validated', validated_at=now()`
3. Modal règle :
   - Pré-remplit pattern regex depuis `raw_label` (ex: "CB CARREFOUR PARIS 12" → `^CB CARREFOUR`)
   - Confirme → `insert categorization_rules`
4. Optionnel : appliquer rétroactivement aux pending existantes

### 8.6 Moteur de règles
**Description** : À chaque import + à la demande, applique règles actives par ordre `priority` croissant.

**Pseudo-code** (`src/lib/rules/engine.ts`) :
```ts
function applyRules(transaction, rules) {
  for (const rule of rules.filter(r => r.is_active).sort((a,b) => a.priority - b.priority)) {
    if (rule.account_id && rule.account_id !== transaction.account_id) continue;
    if (rule.amount_min != null && transaction.amount < rule.amount_min) continue;
    if (rule.amount_max != null && transaction.amount > rule.amount_max) continue;
    if (match(rule, transaction.raw_label)) {
      return {
        subcategory_id: rule.subcategory_id,
        status: rule.auto_validate ? 'validated' : 'pending',
        applied_rule_id: rule.id
      };
    }
  }
  return { status: 'pending' };
}
```

Sur match : `update categorization_rules SET hit_count = hit_count + 1, last_hit_at = now()`.

### 8.7 Transactions récurrentes
**Description** : Détection auto (loyer, salaire, abonnements). Alerte si récurrente attendue manquante.

**Slugs UI** : `card-recurring`, `badge-recurring-active`/`badge-recurring-missing`, `alert-warning`.

**Logique** :
1. Cron ou à la demande : groupe transactions par `(label_normalized, account_id, amount ± tolérance)` sur 6 mois
2. Si ≥ 3 occurrences à intervalle ~mensuel → propose `recurring_pattern`
3. Checker : pour chaque pattern actif, si `last_seen_at + frequency_days < today - grace` → alerte

### 8.8 Dashboard mensuel
**Description** : Vue principale. Sélecteur mois + 4 KPI + camembert catégories + bar chart 12 mois + vue multi-comptes.

**Slugs UI** : `dashboard-hero` (avec `deco-aurora-gradient`), `input-month-picker`, 4× `card-kpi`, `chart-pie-categories`, `chart-bar-monthly`, `card-account-mini`.

**Logique** : `monthly_summary` filtrée mois. Revenus = SUM positifs, Dépenses = SUM abs négatifs, Solde = revenus - dépenses, Épargne = solde / revenus. Delta vs mois précédent (badge `↗ +5%` / `↘ -3%`).

### 8.9 Analytics
**Description** : Top 10 dépenses, top catégories, comparaison mois/précédent/moyenne 12 mois, évolution patrimoine total.

**Slugs UI** : `card-analytics`, `table-top-transactions`, `chart-comparison`, `chart-net-worth-evolution`.

### 8.10 Tags libres
**Description** : Tags transverses ("Vacances été 2026"), indépendants des catégories. Plusieurs tags par transaction.

**Slugs UI** : `badge-tag-md`, `tag-picker`, `input-text-md` (création inline).

### 8.11 Notes & justificatifs
**Description** : Note libre + upload PJ (facture PDF, ticket photo) dans Supabase Storage.

**Slugs UI** : `input-textarea-md`, `attachment-list`, `file-dropzone-mini`.

### 8.12 Recherche full-text (Cmd+K)
**Description** : Recherche dans libellés, notes, tags via `tsvector` + `pg_trgm`.

**Slugs UI** : `global-search-modal`, `search-result-item`.

### 8.13 Export CSV/Excel
**Description** : Export filtré actuel via PapaParse / SheetJS.

**Slugs UI** : `btn-secondary-md` (Exporter), `modal-export-options`.

### 8.14 Realtime
**Description** : Toutes les vues s'auto-rafraîchissent via Supabase Realtime sur tables publiées.

**Implémentation** : hook `useRealtime(table, callback)` qui abonne `postgres_changes` et invalide les queries TanStack Query concernées.

---

## 9. Gestion des erreurs

| Situation | Comportement | Composant |
|---|---|---|
| User non connecté | Redirige `/login` | — |
| User non whitelisté | Logout + `/login?error=unauthorized` | `alert-danger` |
| Fichier import vide / invalide | Annule import, message | `alert-danger` + `toast-error` |
| Format non reconnu | Demande format manuel | `modal-bank-selector` |
| Doublons à l'import | Compteur + confirmation | `alert-info` + `badge-status-duplicate` |
| Règle regex invalide | Bloque sauvegarde | `input-text-md` état error + `form-error-msg` |
| Transaction non catégorisée | Visible dans `/transactions/pending` | `badge-status-pending` |
| Erreur réseau Supabase | Retry auto + toast | `toast-error` |
| Récurrente manquante | Bannière haut dashboard | `alert-warning` |
| Aucune donnée (mois vide) | Empty state + CTA Importer | `empty-state` |
| Permission RLS refusée | Logout + message | `alert-danger` |
| Upload trop gros | Limite 10 Mo + message | `toast-error` |

---

## 10. Variables d'environnement

```env
# .env.local — AUTO-GÉNÉRÉ via MCP Supabase (étape 1)
NEXT_PUBLIC_SUPABASE_URL=https://uujmbqwbnztfxuzhnjwp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# À configurer manuellement
NEXT_PUBLIC_OWNER_EMAIL=ton-email@gmail.com   # email whitelisté (affichage)
NEXT_PUBLIC_APP_URL=http://localhost:3000     # URL canonique (prod = https://…)
```

**À configurer dans Supabase Dashboard** (Authentication → Providers → Google) :
- Activer Google OAuth
- Client ID + Secret (à créer dans Google Cloud Console)
- Redirect URL : `https://uujmbqwbnztfxuzhnjwp.supabase.co/auth/v1/callback`
- Dans le SQL : remplacer `'TON_EMAIL@gmail.com'` dans `is_owner()`

**Côté Vercel** : ajouter les 4 variables ci-dessus dans Project Settings → Environment Variables.

---

## 11. Commandes de démarrage

```bash
# 1. Cloner et installer
git clone https://github.com/nsibille/investh-finance.git
cd investh-finance
npm install

# 2. Templates
cp .mcp.json.example .mcp.json   # remplacer le PAT par le tien
cp .env.local.example .env.local # complété auto par le MCP

# 3. Bootstrap Next.js si pas encore fait (Claude Code le fait)
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --use-npm

# 4. Dépendances métier
npm install @supabase/supabase-js @supabase/ssr
npm install @tanstack/react-query @tanstack/react-table
npm install zustand react-hook-form @hookform/resolvers zod
npm install papaparse xlsx
npm install recharts date-fns lucide-react
npm install geist
npm install -D @types/papaparse vitest @vitejs/plugin-react jsdom

# 5. Dev
npm run dev

# 6. Tests
npm test
```

---

## 12. Ordre d'implémentation (impératif)

### Étape 0 — MCP + DB (AVANT TOUT)
- [ ] Vérifier MCP (`list_projects`)
- [ ] `get_project_url` + `get_publishable_keys` → `.env.local`
- [ ] Exécuter SQL section 6 via `execute_sql`
- [ ] Créer `supabase/migrations/00000000000000_initial_schema.sql`
- [ ] **Remplacer `'TON_EMAIL@gmail.com'`** dans `is_owner()` (demander à l'user)
- [ ] `get_advisors` → 0 erreur RLS
- [ ] `generate_typescript_types` → `src/types/database.types.ts`

### Étape 1 — Bootstrap projet
- [ ] `create-next-app` avec flags section 11
- [ ] Installer toutes les dépendances
- [ ] Tailwind v4 + `globals.css` avec tokens de `DESIGN_SYSTEM.md`
- [ ] Fonts Geist + Geist Mono dans `app/layout.tsx`
- [ ] Providers : QueryClientProvider, Toast provider

### Étape 2 — Auth
- [ ] `/login`, `/auth/callback`
- [ ] Middleware Supabase
- [ ] Check whitelist côté server
- [ ] `(app)/layout.tsx` avec sidebar + header

### Étape 3 — Design system
- [ ] Implémenter TOUS les composants section "Composants" de `DESIGN_SYSTEM.md` dans `src/components/ui/`
- [ ] Vérifier que chaque composant a TOUS ses états

### Étape 4 — Comptes (CRUD)
### Étape 5 — Catégories + règles
### Étape 6 — Import (commencer par parser CSV générique, user fournit exemples CSV pour adapter)
### Étape 7 — Transactions (liste + pending + édition)
### Étape 8 — Dashboard mensuel
### Étape 9 — Récurrentes
### Étape 10 — Analytics + tags + notes + recherche + export
### Étape 11 — Déploiement Vercel
- [ ] Push GitHub → Vercel import
- [ ] Configurer env vars
- [ ] Ajouter URL Vercel à Supabase Auth (Site URL + Redirect URLs)
- [ ] Update Google OAuth Console avec URL Vercel
- [ ] Test login end-to-end

---

## 13. Checklist finale

### Supabase / MCP
- [ ] `.mcp.json` local OK, NON committé
- [ ] `.env.local` généré, NON committé
- [ ] Toutes les tables ont RLS (`get_advisors` clean)
- [ ] `is_owner()` contient le bon email
- [ ] Types TS générés depuis schéma réel
- [ ] Realtime activé (transactions/accounts/imports/rules)
- [ ] Google OAuth configuré dans Supabase
- [ ] Bucket Storage `imports` créé (private)
- [ ] Bucket Storage `attachments` créé (private)

### Fonctionnel
- [ ] Login Google + whitelist OK
- [ ] CRUD comptes complet
- [ ] Import CSV générique fonctionne
- [ ] Dedup empêche doublons
- [ ] Règles regex appliquées à l'import
- [ ] Workflow pending + création règle depuis libellé
- [ ] Catégories 3 niveaux en arbre
- [ ] Tags libres assignables
- [ ] Notes + upload attachments
- [ ] Dashboard mensuel + sélecteur mois
- [ ] Camembert + bar chart corrects
- [ ] Multi-comptes consolidés
- [ ] Récurrentes + alerte manquantes
- [ ] Recherche full-text
- [ ] Export CSV + XLSX
- [ ] Realtime : 2 onglets sync

### Design
- [ ] Composants 100% via tokens CSS (zéro hex hardcodé)
- [ ] Geist + Geist Mono chargés
- [ ] Indigo `#5B5BD6` primaire partout
- [ ] Sémantique vert/rouge/orange/bleu cohérente
- [ ] Index `DESIGN_SYSTEM.md` à jour avec TOUS les slugs créés
- [ ] Chaque composant a tous ses états
- [ ] Responsive mobile testé
- [ ] Densité compacte tables, aérée dashboard
- [ ] Logo Lyra visible (sidebar + favicon)

### Sécurité
- [ ] `.env.local` + `.mcp.json` dans `.gitignore`
- [ ] Aucun secret en source
- [ ] Whitelist email vérifiée server-side (pas seulement client)
- [ ] RLS testée (tenter accès autre compte → refus)
- [ ] HTTPS prod (Vercel auto)
- [ ] `service_role` jamais exposée côté client
