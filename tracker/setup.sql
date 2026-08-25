-- Unified Title & Escrow — shared Title Search Board
-- Run this once in Supabase > SQL Editor.

create table if not exists public.tracker_state (
  id text primary key,
  cases jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.tracker_state enable row level security;

revoke all on table public.tracker_state from anon;
grant select, insert, update on table public.tracker_state to authenticated;

drop policy if exists "Office users can read tracker" on public.tracker_state;
create policy "Office users can read tracker"
on public.tracker_state for select
to authenticated
using (id = 'office');

drop policy if exists "Office users can create tracker" on public.tracker_state;
create policy "Office users can create tracker"
on public.tracker_state for insert
to authenticated
with check (id = 'office');

drop policy if exists "Office users can update tracker" on public.tracker_state;
create policy "Office users can update tracker"
on public.tracker_state for update
to authenticated
using (id = 'office')
with check (id = 'office');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tracker_state'
  ) then
    alter publication supabase_realtime add table public.tracker_state;
  end if;
end $$;

