-- ============================================================
-- 0006 — RLS: atasan = golongan >= 5 DAN title SPV ke atas
-- Ganti cek RLS berbasis golongan dengan cek yang title-aware.
-- Fallback: baris lama (title NULL) dengan golongan >= 5 tetap dianggap atasan.
-- ============================================================

create or replace function public.get_user_is_atasan()
returns boolean
language sql
security definer set search_path = public
as $$
  select
    golongan >= 5
    and (
      coalesce(title, '') in ('SPV','Assistant Manager','Section Manager')
      or (title is null and golongan >= 5)
    )
  from public.users where id = auth.uid()
$$;

-- users
drop policy if exists "users write golongan >= 5" on public.users;
create policy "users write golongan >= 5" on public.users
  for all to authenticated
  using (public.get_user_is_atasan())
  with check (public.get_user_is_atasan());

-- pending_registrations
drop policy if exists "pending_reg read authenticated" on public.pending_registrations;
create policy "pending_reg read authenticated" on public.pending_registrations
  for select to authenticated using (public.get_user_is_atasan());

drop policy if exists "pending_reg write golongan >= 5" on public.pending_registrations;
create policy "pending_reg write golongan >= 5" on public.pending_registrations
  for all to authenticated
  using (public.get_user_is_atasan())
  with check (public.get_user_is_atasan());

-- tasks
drop policy if exists "tasks insert golongan >= 5" on public.tasks;
create policy "tasks insert golongan >= 5" on public.tasks
  for insert to authenticated with check (public.get_user_is_atasan());

drop policy if exists "tasks update golongan >= 5" on public.tasks;
create policy "tasks update golongan >= 5" on public.tasks
  for update to authenticated using (public.get_user_is_atasan());

-- task_reports
drop policy if exists "reports update golongan >= 5" on public.task_reports;
create policy "reports update golongan >= 5" on public.task_reports
  for update to authenticated using (public.get_user_is_atasan());

-- task_problems
drop policy if exists "problems update golongan >= 5" on public.task_problems;
create policy "problems update golongan >= 5" on public.task_problems
  for update to authenticated using (public.get_user_is_atasan());

-- notification_channels
drop policy if exists "channels write golongan >= 5" on public.notification_channels;
create policy "channels write golongan >= 5" on public.notification_channels
  for all to authenticated
  using (public.get_user_is_atasan())
  with check (public.get_user_is_atasan());
