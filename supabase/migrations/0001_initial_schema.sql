-- ============================================================
-- Task Tracker Production Engineering — initial schema
-- Stack: Supabase (PostgreSQL) + Vercel
-- Jalankan via: supabase db push  (atau tempel di Supabase SQL Editor)
-- ============================================================

-- ---------- users ----------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  nik text unique,
  golongan integer not null default 1,
  atasan_id uuid references public.users(id),
  telegram_chat_id text unique,
  created_at timestamptz not null default now()
);

-- ---------- pending_registrations ----------
create table if not exists public.pending_registrations (
  chat_id text primary key,
  nama text not null,
  nik text not null,
  golongan integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------- tasks ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  assigned_by uuid references public.users(id),
  assigned_to uuid references public.users(id),
  title text not null,
  description text,
  status text not null default 'assigned'
    check (status in ('assigned','in_progress','report_submitted','approved','rejected')),
  points integer not null default 0,
  deadline date,
  created_at timestamptz not null default now()
);

-- ---------- task_reports (completion report) ----------
create table if not exists public.task_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id),
  progress_note text not null,
  photo_url text,
  status text not null default 'report_submitted',
  created_at timestamptz not null default now()
);

-- ---------- task_problems (problem report) ----------
create table if not exists public.task_problems (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id),
  urgency text not null check (urgency in ('bisa_nunggu','perlu_hari_ini','mendesak')),
  description text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  keputusan text,
  created_at timestamptz not null default now()
);

-- ---------- points_history ----------
create table if not exists public.points_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  task_id uuid references public.tasks(id),
  points integer not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_reports_task on public.task_reports(task_id);
create index if not exists idx_problems_task on public.task_problems(task_id);
create index if not exists idx_points_user on public.points_history(user_id);

-- ---------- realtime ----------
alter table public.tasks replica identity full;
alter table public.task_reports replica identity full;
alter table public.task_problems replica identity full;
alter table public.points_history replica identity full;
-- Catatan: aktifkan Realtime untuk tabel di atas via Supabase Dashboard
-- (Database -> Replication -> supabase_realtime) atau lewat publication.

-- ============================================================
-- Auto-create public.users saat ada user baru di auth.users
-- (agar signup web dashboard langsung punya baris profil)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, nama, nik, golongan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', split_part(coalesce(new.email, 'user'), '@', 1)),
    nullif(new.raw_user_meta_data->>'nik', ''),
    coalesce((new.raw_user_meta_data->>'golongan')::int, 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Row Level Security (RLS) — wajib aktif
-- ============================================================
alter table public.users enable row level security;
alter table public.pending_registrations enable row level security;
alter table public.tasks enable row level security;
alter table public.task_reports enable row level security;
alter table public.task_problems enable row level security;
alter table public.points_history enable row level security;

-- Helper: golongan user yang sedang login
create or replace function public.get_user_golongan()
returns integer
language sql
security definer
as $$
  select golongan from public.users where id = auth.uid()
$$;

-- users
create policy "users read authenticated" on public.users
  for select to authenticated using (true);

create policy "users write golongan >= 5" on public.users
  for all to authenticated
  using (public.get_user_golongan() >= 5)
  with check (public.get_user_golongan() >= 5);

-- pending_registrations
create policy "pending_reg read authenticated" on public.pending_registrations
  for select to authenticated using (public.get_user_golongan() >= 5);

create policy "pending_reg write golongan >= 5" on public.pending_registrations
  for all to authenticated
  using (public.get_user_golongan() >= 5)
  with check (public.get_user_golongan() >= 5);

-- tasks
create policy "tasks read authenticated" on public.tasks
  for select to authenticated using (true);

create policy "tasks insert golongan >= 5" on public.tasks
  for insert to authenticated with check (public.get_user_golongan() >= 5);

create policy "tasks update golongan >= 5" on public.tasks
  for update to authenticated using (public.get_user_golongan() >= 5);

-- task_reports
create policy "reports read authenticated" on public.task_reports
  for select to authenticated using (true);

create policy "reports insert own" on public.task_reports
  for insert to authenticated with check (auth.uid() = user_id);

create policy "reports update golongan >= 5" on public.task_reports
  for update to authenticated using (public.get_user_golongan() >= 5);

-- task_problems
create policy "problems read authenticated" on public.task_problems
  for select to authenticated using (true);

create policy "problems insert own" on public.task_problems
  for insert to authenticated with check (auth.uid() = user_id);

create policy "problems update golongan >= 5" on public.task_problems
  for update to authenticated using (public.get_user_golongan() >= 5);

-- points_history
create policy "points read authenticated" on public.points_history
  for select to authenticated using (true);

-- Sengaja TIDAK ADA policy INSERT/UPDATE/DELETE pada points_history untuk client.
-- Penulisan points_history hanya lewat server (Vercel Function) dengan
-- SUPABASE_SERVICE_ROLE_KEY (bypass RLS), supaya poin tidak bisa dimanipulasi.
