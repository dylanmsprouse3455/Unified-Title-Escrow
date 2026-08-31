-- Title Search per-case cloud storage.
-- The live database migration is applied through Supabase; this file documents the schema.

create table if not exists public.title_search_cases (
  id text primary key,
  case_number text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted_at timestamptz
);

alter table public.title_search_cases enable row level security;

grant select, insert, update, delete on table public.title_search_cases to authenticated;
revoke all on table public.title_search_cases from anon;

-- Existing office authentication remains the access boundary, matching tracker_state.
-- The production migration also installs:
-- 1. Office-user RLS policies for authenticated users.
-- 2. A one-time migration from tracker_state.cases into individual rows.
-- 3. A legacy-to-row bridge that accepts only newer per-case timestamps.
-- 4. A row-to-legacy mirror while older pages are still open.
-- 5. save_title_search_case(...), an optimistic compare-and-swap RPC that refuses
--    to overwrite a case when another employee saved that same case first.
