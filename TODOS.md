# TODOS — Task Tracker Production Engineering

> Daftar task yang AKAN dikerjakan. Update file ini setiap ada progress (dan pindahkan item selesai ke `COMPLETED.md`).
> Status validasi terakhir (2026-08-25): `npm run build` ✅ dan `npm run lint` ✅. Deploy Vercel **live** di `macha-app-sigma.vercel.app` (build READY/PROMOTED). E2E API test **14/14 PASS** ke produksi. Broadcast group/channel Telegram + email Resend sudah terimplementasi. Rincian di `COMPLETED.md`.

---

## Fondasi kode & validasi (SELESAI)

- [x] Scaffold Next.js App Router + seluruh halaman + API routes + `lib/*` (lihat `COMPLETED.md`)
- [x] `npm install` berhasil (dengan workaround jaringan lambat)
- [x] `npm run build` berhasil
- [x] Setup ESLint (`eslint` + `eslint-config-next` + `.eslintrc.json`) dan `npm run lint` berhasil

---

## Sprint 0 — Persiapan akun & akses

- [x] Project Supabase dibuat (`pnpzkdyamjnxhujhbwjw`) — `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` sudah diisi
- [x] Ambil `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API → service_role)
- [x] Buat bot Telegram lewat @BotFather → simpan `TELEGRAM_BOT_TOKEN` (`@MachApp_bot`, token valid)
- [x] Tentukan admin approval + dapatkan `TELEGRAM_ADMIN_CHAT_ID`
- [x] Set `TELEGRAM_WEBHOOK_SECRET` (secret token saat `setWebhook`)
- [x] Daftar akun email service (Resend sandbox) → `EMAIL_API_KEY` + `EMAIL_FROM`
- [x] Setup Vercel project + environment variables (8 env var production ter-set via REST API)
- [x] Isi semua placeholder rahasia di `.env.local` (jangan commit)

## Sprint 1 — Fondasi data & auth

- [x] Push migration `0001_initial_schema.sql` ke Supabase (via pooler `aws-0-ap-northeast-1.pooler.supabase.com`; 6 tabel + 14 policy RLS)
- [x] Review RLS policies di dashboard Supabase (14 policy terpasang, terverifikasi via `pg_policies`)
- [x] Aktifkan Email/Password di Supabase Auth (default aktif; terverifikasi signInWithPassword)
- [x] Seed data dummy user — 6 user (golongan 1–7) via Admin API; trigger `handle_new_user` mengisi `public.users`
- [x] Verifikasi login Supabase Auth + baca data dummy (sign-in OK via anon key)

## Sprint 2 — Registrasi & approval Telegram

- [x] Deploy ke Vercel + set webhook `/api/telegramWebhook` (URL `macha-app-sigma.vercel.app`, webhook "was set")
- [x] Implementasi alur `/start` → nama/NIK/golongan → `pending_registrations` + tombol inline Setujui/Tolak + `registerApprove`/`registerReject` (kode selesai)
- [ ] Uji end-to-end alur registrasi dengan bot Telegram asli (butuh akun Telegram + admin asli)

## Sprint 3 — Task assignment & notifikasi

- [x] Uji `POST /api/tasks` dari dashboard atasan (E2E ✅)
- [x] Uji `GET /api/tasks?userId=` di dashboard technician (E2E ✅)
- [x] Wiring notif Telegram otomatis saat task dibuat (via `notifyTelegram`, route `tasks`)
- [ ] Validasi notif Telegram benar-benar terkirim ke chat/group asli (butuh bot asli + `notification_channels` terisi)

## Sprint 4 — Completion report & approval poin

- [x] Uji form lapor selesai (POST report) (E2E ✅)
- [x] Uji antrian approval di dashboard atasan (`/tasks/pendingApproval`) (E2E ✅, fix import `mapReport`)
- [x] Uji transaksi approve/reject (status + poin atomik via RPC `approve_report`) (E2E ✅)
- [x] Uji skenario reject → revisi → submit ulang (E2E ✅)
- [ ] Uji upload foto ke Supabase Storage (belum tercakup di E2E)

## Sprint 5 — Problem report & statistik

- [x] Uji form problem report (POST problem) (E2E ✅)
- [x] Uji endpoint `/users/{id}/points` dan `/teams/{id}/stats` (E2E ✅)
- [x] Wiring notif prioritas tinggi ke atasan (via `notifyTelegram`, route `problems`)
- [ ] Uji problem report via Telegram + notif prioritas tinggi terkirim ke chat asli (butuh bot asli)
- [ ] Uji metric card dashboard atasan + kartu "poin bulan ini" (polish UI)

## Sprint 6 — Email & polish

- [x] Integrasi email service + template notifikasi (Resend via `lib/email.js`, terpasang di 5 titik notifikasi)
- [x] Kirim email test Resend sandbox → `hikenautomation@gmail.com` (HTTP 200)
- [x] Review keamanan: `points_history` hanya punya policy SELECT (tidak ada write langsung dari client)
- [ ] Verifikasi domain pengirim Resend (user-dependent) + tes tidak masuk spam kantor
- [ ] Polish UI sesuai `DESIGN.md` di semua halaman
- [ ] Tambah empty state & error state yang informatif

## Fitur broadcast group/channel Telegram (SELESAI)

- [x] Migrasi `0003_notification_channels.sql` (tabel `notification_channels`) — dibuat & diterapkan
- [x] `lib/telegram.js`: `listNotificationChannels()` + `notifyTelegram()` (broadcast ke semua channel + admin)
- [x] Perintah admin bot: `/daftargrup` & `/hapusgrup`
- [x] Notifikasi completion/problem di semua route task memakai `notifyTelegram`
- [x] `SETUP_TELEGRAM.md` diperbarui (alur bot lengkap: registrasi, group/channel, laporan, ringkasan notifikasi)
- [ ] Validasi `/daftargrup` di group/channel asli (bot jadi admin + disable Group Privacy) — butuh aksi user

---

## Sprint 7 — UAT & stabilisasi

- [ ] Pilih 5-10 orang dari berbagai golongan untuk uji nyata
- [ ] Kumpulkan feedback harian (grup Telegram terpisah)
- [ ] Perbaiki bug & gesekan UX
- [ ] Setup scheduled backup database
- [ ] Finalisasi budget alert & monitoring

## Sprint 8 — Go-live & rollout

- [ ] Rollout bertahap per line/section
- [ ] Onboarding singkat (`/start` bot + cara submit laporan)
- [ ] Monitoring ketat minggu pertama + hotfix cepat
- [ ] Kumpulkan masukan roadmap fase berikutnya
