-- ============================================================================
-- LYRA — bank_connections (GoCardless Bank Account Data linkage)
-- ============================================================================
create table if not exists public.bank_connections (
  id               uuid primary key default gen_random_uuid(),
  requisition_id   text not null,
  reference        text not null unique,
  institution_id   text not null,
  institution_name text,
  gc_account_id    text unique,
  account_id       uuid references public.accounts(id) on delete set null,
  iban             text,
  status           text not null default 'created',
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_bank_connections_account on public.bank_connections(account_id);
create index if not exists idx_bank_connections_requisition on public.bank_connections(requisition_id);
drop trigger if exists trg_bank_connections_updated_at on public.bank_connections;
create trigger trg_bank_connections_updated_at before update on public.bank_connections
  for each row execute function public.set_updated_at();

alter table public.bank_connections enable row level security;
create policy bank_connections_select on public.bank_connections for select using (public.is_owner());
create policy bank_connections_insert on public.bank_connections for insert with check (public.is_owner());
create policy bank_connections_update on public.bank_connections for update using (public.is_owner()) with check (public.is_owner());
create policy bank_connections_delete on public.bank_connections for delete using (public.is_owner());
