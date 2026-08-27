-- ============================================================
-- 0010 — external_requests + telegram_external_convos
-- Laporan masalah umum (/laporan) & permintaan improvement (/request)
-- dari seksi lain. Bukan task-bound, jadi dipisah dari task_problems.
-- Ditulis hanya lewat server (service role), konsisten dengan points_history.
-- Idempoten: create table if not exists + drop policy if exists.
-- ============================================================

create table if not exists public.external_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('problem','improvement')),
  nama text not null,
  npk text,
  telegram_chat_id text,
  description text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  keputusan text,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_external_convos (
  chat_id text primary key,
  type text not null check (type in ('problem','improvement')),
  step text not null check (step in ('nama','npk','deskripsi')),
  nama text,
  npk text,
  created_at timestamptz not null default now()
);

alter table public.external_requests enable row level security;
alter table public.telegram_external_convos enable row level security;

-- external_requests: atasan bisa baca; tidak ada write langsung dari client
-- (hanya server dengan service role, seperti points_history).
drop policy if exists "external read authenticated" on public.external_requests;
create policy "external read authenticated" on public.external_requests
  for select to authenticated using (true);

-- telegram_external_convos: tanpa policy client; hanya dibaca/ditulis via service role.
