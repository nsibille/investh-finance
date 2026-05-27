-- ============================================================================
-- LYRA — INITIAL SCHEMA
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- WHITELIST EMAIL — helper RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() ->> 'email' = 'nicolas.h.sibille@gmail.com'
$$;

-- ============================================================================
-- TRIGGER updated_at générique
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
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
CREATE INDEX IF NOT EXISTS idx_transactions_month ON public.transactions((date_trunc('month', operation_date::timestamp)));
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
CREATE OR REPLACE VIEW public.monthly_summary
WITH (security_invoker = on) AS
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
CREATE OR REPLACE VIEW public.account_balances
WITH (security_invoker = on) AS
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
