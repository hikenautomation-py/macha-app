# TODOS — Task Tracker Production Engineering

> Daftar task yang AKAN dikerjakan. Update file ini setiap ada progress (dan pindahkan item selesai ke `COMPLETED.md`).
> Status validasi terakhir (2026-08-25): `npm run build` ✅ dan `npm run lint` ✅ (rincian di `COMPLETED.md`). Deploy Vercel live di `macha-app-sigma.vercel.app`, webhook Telegram aktif, 6 user dummy ter-seed.

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
- [ ] Uji alur `/start` → nama/NIK/golongan → `pending_registrations`
- [ ] Uji notifikasi ke admin + tombol inline Setujui/Tolak
- [ ] Uji `registerApprove` / `registerReject` end-to-end

## Sprint 3 — Task assignment & notifikasi

- [ ] Uji `POST /api/tasks` dari dashboard atasan
- [ ] Uji notif Telegram otomatis saat task dibuat
- [ ] Uji `GET /api/tasks?userId=` di dashboard technician

## Sprint 4 — Completion report & approval poin

- [ ] Uji form lapor selesai + upload foto ke Supabase Storage
- [ ] Uji antrian approval di dashboard atasan
- [ ] Uji transaksi approve/reject (status + poin atomik)
- [ ] Uji skenario reject → revisi → submit ulang

## Sprint 5 — Problem report & statistik

- [ ] Uji form problem report (web + Telegram) + urgensi
- [ ] Uji notif prioritas tinggi ke atasan
- [ ] Uji endpoint `/users/{id}/points` dan `/teams/{id}/stats`
- [ ] Uji metric card dashboard atasan + kartu "poin bulan ini"

## Sprint 6 — Email & polish

- [x] Integrasi email service + template notifikasi (Resend via `lib/email.js`, terpasang di 5 titik notifikasi)
- [ ] Tes domain pengirim tidak masuk spam kantor
- [ ] Polish UI sesuai `DESIGN.md` di semua halaman
- [ ] Tambah empty state & error state yang informatif
- [ ] Review keamanan: pastikan tidak ada write langsung ke `points_history` dari client

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
