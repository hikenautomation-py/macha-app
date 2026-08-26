-- ============================================================
-- 0004 — Rename kolom `nik` -> `npk` (Nomor Pokok Karyawan)
-- Idempoten: aman dijalankan ulang; hanya rename bila kolom lama masih ada.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'nik'
  ) then
    alter table public.users rename column nik to npk;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pending_registrations' and column_name = 'nik'
  ) then
    alter table public.pending_registrations rename column nik to npk;
  end if;
end $$;

-- Perbarui trigger handle_new_user agar membaca meta `npk` (bukan `nik`).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, nama, npk, golongan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', split_part(coalesce(new.email, 'user'), '@', 1)),
    nullif(new.raw_user_meta_data->>'npk', ''),
    coalesce((new.raw_user_meta_data->>'golongan')::int, 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
