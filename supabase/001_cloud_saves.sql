-- Zero Football: per-user cloud save storage.
-- Run this once in Supabase Dashboard -> SQL Editor -> New query.

create table if not exists public.zf_cloud_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.zf_cloud_saves enable row level security;

-- Each authenticated player can access only their own save.
drop policy if exists "Players can read their own Zero Football save" on public.zf_cloud_saves;
create policy "Players can read their own Zero Football save"
  on public.zf_cloud_saves for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can create their own Zero Football save" on public.zf_cloud_saves;
create policy "Players can create their own Zero Football save"
  on public.zf_cloud_saves for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Players can update their own Zero Football save" on public.zf_cloud_saves;
create policy "Players can update their own Zero Football save"
  on public.zf_cloud_saves for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.zf_cloud_saves is 'Zero Football account cloud saves; one JSON snapshot per authenticated user.';
