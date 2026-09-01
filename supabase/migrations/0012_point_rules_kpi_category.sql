-- 0012 gamifikasi: kategori KPI di tasks + tabel point_rules
-- Sumber bobot: file "role & responsibility.xlsx" sheet "Bobot KPI"
-- (pembobotan KPI per level jabatan).

-- Kategori KPI pada task (nullable untuk task lama).
alter table public.tasks
  add column if not exists kpi_category text
  check (kpi_category in ('kualitas', 'produktivitas', 'efisiensi_cost', 'improvement', 'people_5s'));

create index if not exists idx_tasks_kpi_category on public.tasks(kpi_category);

-- Aturan bobot poin per level jabatan x kategori KPI.
create table if not exists public.point_rules (
  id uuid primary key default gen_random_uuid(),
  level text not null unique
    check (level in ('operator', 'supervisor', 'asisten_manager', 'section_manager', 'department_manager')),
  kualitas numeric(4,2) not null,
  produktivitas numeric(4,2) not null,
  efisiensi_cost numeric(4,2) not null,
  improvement numeric(4,2) not null,
  people_5s numeric(4,2) not null,
  updated_at timestamptz not null default now()
);

-- Seed bobot persis dari sheet "Bobot KPI" (idempoten).
insert into public.point_rules (level, kualitas, produktivitas, efisiensi_cost, improvement, people_5s)
values
  ('operator',           0.40, 0.30, 0.10, 0.10, 0.10),
  ('supervisor',         0.30, 0.30, 0.20, 0.10, 0.10),
  ('asisten_manager',    0.25, 0.25, 0.25, 0.15, 0.10),
  ('section_manager',    0.20, 0.25, 0.25, 0.20, 0.10),
  ('department_manager', 0.15, 0.25, 0.30, 0.20, 0.10)
on conflict (level) do nothing;

-- RLS: semua user login boleh baca; tulis hanya lewat service role (bypass RLS).
alter table public.point_rules enable row level security;

drop policy if exists point_rules_select on public.point_rules;
create policy point_rules_select on public.point_rules
  for select to authenticated using (true);
