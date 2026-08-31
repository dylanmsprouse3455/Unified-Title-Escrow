-- Dylan-only central storage for Calls & Follow-Ups.
-- Existing browser localStorage remains a local backup/offline cache.

create table if not exists public.dylan_call_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.dylan_call_records enable row level security;

revoke all on table public.dylan_call_records from anon;
grant select, insert, update, delete on table public.dylan_call_records to authenticated;

drop policy if exists "Dylan can read his call records" on public.dylan_call_records;
create policy "Dylan can read his call records"
on public.dylan_call_records
for select
to authenticated
using (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
);

drop policy if exists "Dylan can create his call records" on public.dylan_call_records;
create policy "Dylan can create his call records"
on public.dylan_call_records
for insert
to authenticated
with check (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
);

drop policy if exists "Dylan can update his call records" on public.dylan_call_records;
create policy "Dylan can update his call records"
on public.dylan_call_records
for update
to authenticated
using (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
)
with check (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
);

drop policy if exists "Dylan can delete his call records" on public.dylan_call_records;
create policy "Dylan can delete his call records"
on public.dylan_call_records
for delete
to authenticated
using (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
);

create index if not exists dylan_call_records_user_updated_idx
  on public.dylan_call_records (user_id, updated_at desc);

create index if not exists dylan_call_records_active_idx
  on public.dylan_call_records (user_id, deleted_at)
  where deleted_at is null;
