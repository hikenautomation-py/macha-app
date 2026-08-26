-- ============================================================
-- 0005 — Tambah kolom `title` (jabatan) ke users & pending_registrations
-- Idempoten: pakai `add column if not exists`.
-- ============================================================

alter table public.users add column if not exists title text;
alter table public.pending_registrations add column if not exists title text;

-- Perbarui trigger handle_new_user agar ikut menyalin `title` dari meta.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, nama, npk, golongan, title)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', split_part(coalesce(new.email, 'user'), '@', 1)),
    nullif(new.raw_user_meta_data->>'npk', ''),
    coalesce((new.raw_user_meta_data->>'golongan')::int, 1),
    nullif(new.raw_user_meta_data->>'title', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
