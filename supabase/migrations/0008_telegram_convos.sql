-- ============================================================
-- 0008 — tabel `telegram_convos`: konteks aksi task di bot Telegram.
--        Dipakai untuk menangkap teks lanjutan setelah user menekan
--        tombol inline Lapor / Update / Selesai pada notifikasi task baru
--        (tombol inline tidak bisa memunculkan input teks, jadi pesan
--        berikutnya disimpan dulu per chat_id).
--        Hanya ditulis lewat server (service role), bukan dari client.
-- ============================================================

create table if not exists public.telegram_convos (
  chat_id    text primary key,
  task_id    uuid not null,
  action     text not null, -- 'lapor' | 'update' | 'selesai'
  created_at timestamptz not null default now()
);

alter table public.telegram_convos enable row level security;

-- Tidak ada policy akses dari client: tabel hanya boleh dibaca/ditulis
-- lewat service role (server), konsisten dengan points_history.