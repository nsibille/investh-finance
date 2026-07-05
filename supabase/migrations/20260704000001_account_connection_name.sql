-- Nom de la connexion bancaire (ex. export Bankin' "Nom de la connexion").
-- Sert de pivot pour rattacher/créer automatiquement un compte lors d'un
-- import CSV.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS connection_name text;
CREATE INDEX IF NOT EXISTS idx_accounts_connection
  ON public.accounts(connection_name)
  WHERE connection_name IS NOT NULL;
