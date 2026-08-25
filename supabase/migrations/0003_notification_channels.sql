-- ============================================================
-- notification_channels — daftar group/channel Telegram penerima broadcast notifikasi
-- ============================================================
create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null unique,
  nama text,
  chat_type text not null default 'group',
  created_at timestamptz not null default now()
);

alter table public.notification_channels enable row level security;

-- Idempoten: kebijakan di-drop dulu sebelum dibuat ulang.
drop policy if exists "channels read authenticated" on public.notification_channels;
create policy "channels read authenticated" on public.notification_channels
  for select to authenticated using (true);

drop policy if exists "channels write golongan >= 5" on public.notification_channels;
create policy "channels write golongan >= 5" on public.notification_channels
  for all to authenticated
  using (public.get_user_golongan() >= 5)
  with check (public.get_user_golongan() >= 5);
