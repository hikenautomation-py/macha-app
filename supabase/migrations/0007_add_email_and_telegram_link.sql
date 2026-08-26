-- ============================================================
-- 0007 — Kolom `email` di users & pending_registrations
--        + dukungan penautan Telegram <-> web via NPK
-- Idempoten: pakai `add column if not exists`.
-- ============================================================

alter table public.users add column if not exists email text;
alter table public.pending_registrations add column if not exists email text;

-- Backfill email untuk akun web yang sudah terdaftar (ambil dari auth.users).
update public.users u
set email = a.email
from auth.users a
where u.id = a.id
  and u.email is null
  and a.email is not null;

-- Perbarui trigger handle_new_user agar ikut menyimpan email dari auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, nama, npk, golongan, title, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', split_part(coalesce(new.email, 'user'), '@', 1)),
    nullif(new.raw_user_meta_data->>'npk', ''),
    coalesce((new.raw_user_meta_data->>'golongan')::int, 1),
    nullif(new.raw_user_meta_data->>'title', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
