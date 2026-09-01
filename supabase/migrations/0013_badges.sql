-- 0013 gamifikasi: badges + user_badges
-- Badge dipetakan ke KPI sheet "KPI PE" di role & responsibility.xlsx.

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  nama text not null,
  deskripsi text not null,
  emoji text not null default '🏅',
  kpi_category text
    check (kpi_category in ('kualitas', 'produktivitas', 'efisiensi_cost', 'improvement', 'people_5s')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index if not exists idx_user_badges_user on public.user_badges(user_id);

-- Seed badge awal (idempoten) — kriteria dievaluasi server-side.
insert into public.badges (code, nama, deskripsi, emoji, kpi_category)
values
  ('kaizen_star',     'Kaizen Star',     '3 task kategori Improvement disetujui dalam satu kuartal.', '💡', 'improvement'),
  ('speed_responder', 'Speed Responder', 'Rata-rata waktu respons problem ≤ 2 jam dalam sebulan.',    '⚡', 'produktivitas'),
  ('champion_5s',     '5S Champion',     '5 task kategori People & 5S disetujui.',                     '🧹', 'people_5s'),
  ('quality_guard',   'Quality Guard',   '10 task kategori Kualitas disetujui tanpa reject.',          '🛡️', 'kualitas'),
  ('cost_saver',      'Cost Saver',      '3 task kategori Efisiensi & Cost disetujui.',                '💰', 'efisiensi_cost'),
  ('on_time_streak',  'On-Time Streak',  '10 task berturut-turut selesai sebelum deadline.',           '🔥', null)
on conflict (code) do nothing;

-- RLS: semua user login boleh baca; award hanya lewat service role.
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges
  for select to authenticated using (true);

drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges
  for select to authenticated using (true);
