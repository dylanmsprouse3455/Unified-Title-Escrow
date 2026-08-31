-- Voice To-Do List — additive setup only.
-- Review, then run once in Supabase > SQL Editor when cloud persistence is approved.

create table if not exists public.dylan_voice_todos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  details text check (details is null or char_length(details) <= 4000),
  due_date date,
  due_time time,
  due_text text check (due_text is null or char_length(due_text) <= 200),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  completed boolean not null default false,
  original_request text check (original_request is null or char_length(original_request) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Additive and safe if the table was created before this revision is reviewed.
alter table public.dylan_voice_todos add column if not exists deleted_at timestamptz;

alter table public.dylan_voice_todos enable row level security;

revoke all on table public.dylan_voice_todos from anon;
grant select, insert, update, delete on table public.dylan_voice_todos to authenticated;

drop policy if exists "Dylan can read his own voice todos" on public.dylan_voice_todos;
create policy "Dylan can read his own voice todos"
on public.dylan_voice_todos for select
to authenticated
using (
  (select auth.uid()) = user_id
  and lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
);

drop policy if exists "Dylan can create his own voice todos" on public.dylan_voice_todos;
create policy "Dylan can create his own voice todos"
on public.dylan_voice_todos for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
);

drop policy if exists "Dylan can update his own voice todos" on public.dylan_voice_todos;
create policy "Dylan can update his own voice todos"
on public.dylan_voice_todos for update
to authenticated
using (
  (select auth.uid()) = user_id
  and lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
)
with check (
  (select auth.uid()) = user_id
  and lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
);

drop policy if exists "Dylan can delete his own voice todos" on public.dylan_voice_todos;
create policy "Dylan can delete his own voice todos"
on public.dylan_voice_todos for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'dylan.sprouse@unifiedtitle.net'
);

create index if not exists dylan_voice_todos_user_created_at_idx on public.dylan_voice_todos (user_id, created_at desc);
