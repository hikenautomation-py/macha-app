-- ============================================================
-- 0009 — teams & team_members + helper hierarki rekursif
-- Model pengelolaan team (SM/ASM/SPV) di atas edge pelaporan
-- `users.atasan_id`. `users.atasan_id` tetap jadi sumber kebenaran
-- visibilitas & assignment; teams adalah lapisan pengelompokan.
-- Idempoten: create table if not exists + drop policy if exists.
-- ============================================================

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  lead_id uuid references public.users(id),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Helper: semua bawahan rekursif dari root (tidak termasuk root),
-- mengikuti edge `users.atasan_id`.
create or replace function public.get_subordinate_ids(p_root uuid)
returns table (id uuid)
language sql
stable
as $$
  with recursive tree as (
    select u.id from public.users u where u.atasan_id = p_root
    union
    select u.id
    from public.users u
    join tree t on u.atasan_id = t.id
  )
  select id from tree;
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "teams read authenticated" on public.teams;
create policy "teams read authenticated" on public.teams
  for select to authenticated using (true);

drop policy if exists "teams write atasan" on public.teams;
create policy "teams write atasan" on public.teams
  for all to authenticated
  using (public.get_user_is_atasan())
  with check (public.get_user_is_atasan());

drop policy if exists "team_members read authenticated" on public.team_members;
create policy "team_members read authenticated" on public.team_members
  for select to authenticated using (true);

drop policy if exists "team_members write atasan" on public.team_members;
create policy "team_members write atasan" on public.team_members
  for all to authenticated
  using (public.get_user_is_atasan())
  with check (public.get_user_is_atasan());
