-- Kør i Supabase SQL editor. Tabellen kan kun skrives af serverfunktionen (service role).
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null, email text not null, phone text, company text, place text, build_year text,
  role text, phase text, newsletter boolean not null default false, consent boolean not null,
  project jsonb
);
alter table public.leads enable row level security;
-- Ingen policies = ingen adgang for anon/authenticated. Service role omgår RLS.
