create table if not exists public.dylan_assistant_action_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text,
  case_number text,
  action_type text not null,
  approved_payload jsonb not null default '{}'::jsonb,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.dylan_assistant_action_audit enable row level security;
revoke all on table public.dylan_assistant_action_audit from anon;
grant select on table public.dylan_assistant_action_audit to authenticated;

drop policy if exists "Dylan can read his assistant audit" on public.dylan_assistant_action_audit;
create policy "Dylan can read his assistant audit"
on public.dylan_assistant_action_audit
for select
to authenticated
using (
  auth.uid() = user_id
  and lower(coalesce(auth.jwt() ->> 'email','')) = 'dylan.sprouse@unifiedtitle.net'
);

create index if not exists dylan_assistant_audit_case_idx
  on public.dylan_assistant_action_audit (case_number, created_at desc);
create index if not exists dylan_assistant_audit_user_idx
  on public.dylan_assistant_action_audit (user_id, created_at desc);
