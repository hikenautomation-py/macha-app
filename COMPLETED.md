# COMPLETED — Task Tracker Production Engineering

> Log task yang SUDAH selesai. Pindahkan item dari `TODOS.md` ke sini saat selesai, beserta tanggalnya.

---

## 2026-08-24 — Scaffold awal & dokumentasi

### Dokumentasi
- [x] `ARCHITECTURE.md` — arsitektur final (Supabase + Vercel + Telegram + Email)
- [x] `DESIGN.md` — design tokens + prinsip UI dari `PROJECT_BRIEF.md` & `mockup.html`
- [x] `apicredential.md` — daftar credential + placeholder yang harus diisi
- [x] `TODOS.md` + `COMPLETED.md` — tracker task
- [x] `API_SPEC.md` / `DEVELOPER.md` — kontrak API + panduan setup

### Kode dasar aplikasi
- [x] Scaffold Next.js (App Router) + `package.json` + config Vercel
- [x] `supabase/migrations/0001_initial_schema.sql` — schema + RLS (users, pending_registrations, tasks, task_reports, task_problems, points_history)
- [x] `lib/supabase.js` — client browser + server + admin (service role)
- [x] `lib/auth.js` — verifikasi Supabase JWT + helper golongan
- [x] `lib/telegram.js` — helper kirim pesan / callback answer / keyboard inline
- [x] Seluruh API routes sesuai `API_SPEC.md` (register, tasks, reports, problems, points, stats, telegramWebhook)
- [x] Halaman web dashboard: login, dashboard atasan, dashboard technician, buat task, lapor selesai, lapor masalah
- [x] Komponen UI (TicketCard, Badge, MetricCard) + design token CSS sesuai mockup

---

## 2026-08-24 — Validasi build, lint & hardening keamanan

### Root cause build hang: SWC binary korup (bukan font)
- [x] Diagnosa `npm run build` hang → root cause `@next/swc-win32-x64-msvc` binary terpotong (50 MB, seharusnya ~135.86 MB) akibat `npm install` yang pernah terinterupsi
- [x] Reinstall `@next/swc-win32-x64-msvc@14.2.21` → binary lengkap (135.857.664 bytes)
- [x] `npm run build` BERHASIL: `✓ Compiled successfully`, 14 static pages, semua route terdaftar

### Robustness
- [x] Ganti `next/font/google` (unduh font saat build, rawan hang saat jaringan lambat) → system font stack di `app/globals.css`

### Lint
- [x] Setup ESLint: `eslint@8.57.1` + `eslint-config-next@14.2.21` (devDependencies) + `.eslintrc.json` (`next/core-web-vitals`)
- [x] `npm run lint` BERHASIL: `No ESLint warnings or errors`

### Keamanan
- [x] Validasi secret token webhook Telegram (`TELEGRAM_WEBHOOK_SECRET` + header `X-Telegram-Bot-Api-Secret-Token`) di `app/api/telegramWebhook/route.js`
- [x] `.env.local.example` memuat `TELEGRAM_WEBHOOK_SECRET`
- [x] `.gitignore` mengabaikan `.env*` dan `apicredential.md`

---

## 2026-08-25 — Integrasi notifikasi, E2E test & deploy produksi

### Notifikasi Telegram group/channel (broadcast)
- [x] Migrasi `supabase/migrations/0003_notification_channels.sql` (tabel `notification_channels`) — dibuat & diterapkan
- [x] `lib/telegram.js`: tambah `listNotificationChannels()` + `notifyTelegram()` (broadcast ke semua channel + admin)
- [x] `app/api/telegramWebhook/route.js`: perintah admin `/daftargrup` & `/hapusgrup`
- [x] Route `tasks`, `problems`, `reports`, `approve`, `reject` kini pakai `notifyTelegram`
- [x] `SETUP_TELEGRAM.md` diperbarui (alur bot lengkap: registrasi, group/channel, laporan, ringkasan notifikasi)

### Database
- [x] Terapkan RPC `approve_report` (`0002_rpc_approve.sql`) — sebelumnya belum ter-apply
- [x] Set hierarki `atasan_id` untuk 6 user dummy (supervisor/team stats testable)
- [x] Konfirmasi `points_history` hanya punya policy SELECT (tidak ada write langsung dari client)

### Email (Resend)
- [x] Kirim email test sandbox ke `hikenautomation@gmail.com` — HTTP 200 (id `baace777-ddb3-4d8c-9fce-3ce1df59433c`)

### E2E API test ke produksi (`macha-app-sigma.vercel.app`) — 14/14 PASS
- [x] sign-in (sm & tech), RBAC (403), create/list task, completion report, pendingApproval, approve (+10 poin atomik), points, problem report, reject → in_progress → resubmit, team stats

### Bug fix
- [x] `app/api/tasks/pendingApproval/route.js` missing import `mapReport` (penyebab 500/ReferenceError) — fixed & terverifikasi 200 di produksi

### Deploy Vercel
- [x] `npm run lint` ✅ & `npm run build` ✅
- [x] Deploy produksi READY/PROMOTED (alias `macha-app-sigma.vercel.app` ter-update)
- [x] `.vercel/project.json` (project/org id) untuk `vercel link`

## 2026-08-26 — Penautan Web ↔ Telegram via NPK, email registrasi & domain

### Penautan akun (web ↔ Telegram)
- [x] Alur bot baru: `/start` → input **NPK** → dicocokkan ke tabel `users`: sudah ada → `telegram_chat_id` langsung di-set (penautan akun web); belum ada → registrasi lanjut (nama → golongan → title → email)
- [x] Migrasi `0007_add_email_and_telegram_link.sql` — kolom `email` di `users` + `pending_registrations`, backfill dari `auth.users`, trigger `handle_new_user` menyimpan email (idempoten)
- [x] `0001_initial_schema.sql` disinkronkan (kolom `email` + trigger terbaru)
- [x] `lib/constants.js`: konstanta `WEB_APP_URL=https://app.machapp.web.id`
- [x] `lib/email.js`: `getUserEmail` fallback ke `users.email`; template baru `emailRegistrationApproved`
- [x] `registerApprove` & `registerRequest` menyimpan `email`; approval mengirim email "akun aktif"
- [x] Pesan akhir registrasi: menunggu approval + saran login di `app.machapp.web.id`

### Email & domain
- [x] `EMAIL_API_KEY` baru + `EMAIL_FROM=Macha App <notif.machapp.web.id>` (diisi user di `.env.local` / Vercel)
- [x] Domain web app didaftarkan: **app.machapp.web.id**

### Validasi
- [x] `npm run lint` ✅ (No ESLint warnings or errors)
- [x] `npm run build` ✅ (14/14 halaman, semua route API ter-compile)
- [x] Migrasi `0007` di-apply ke Supabase produksi (oleh user) + deploy Vercel
- [ ] Uji E2E penautan + alur registrasi baru di bot asli (butuh migrasi + deploy)

---

## 2026-08-27 — Teams, hierarki, laporan umum & polish dashboard

### Organisasi & hierarki (Sprint 2)
- [x] Migrasi `0009_teams.sql` — tabel `teams` + `team_members` + function `get_subordinate_ids` (recursive CTE)
- [x] `lib/hierarchy.js` — `getSubordinateIds` / `getViewableUserIds` / `isWithinSubtree`
- [x] `app/api/teams/route.js` — GET (daftar team) + POST (buat team)
- [x] `app/api/teams/[id]/members/route.js` — tambah/hapus anggota + sinkron `users.atasan_id`
- [x] `app/teams/page.js` — halaman kelola team (atasan)
- [x] Pengetatan akses: `GET/POST /api/tasks`, `GET /api/tasks/pendingApproval`, `GET /api/teams/{id}/stats`, `PATCH /api/tasks/{id}/status`

### Laporan umum & request (Sprint 5)
- [x] Migrasi `0010_external_requests.sql` — tabel `external_requests` + `telegram_external_convos`
- [x] `app/api/external/route.js` — POST publik + GET atasan
- [x] `app/api/external/[id]/resolve/route.js` — resolve laporan umum/request
- [x] `app/api/problems/route.js` — list problem report task (atasan)
- [x] `app/api/dashboard/summary/route.js` — payload metric card
- [x] `lib/email.js` — `emailExternalReport` (kirim ke semua atasan)
- [x] Telegram `/laporan` & `/request` + alur multi-step nama → NPK → deskripsi
- [x] Form web publik `/laporan` & `/request`

### Polish dashboard (Sprint 5)
- [x] Dashboard atasan: 4 metric card + section problem report + laporan umum/request + statistik tim

### Validasi
- [x] `npm run lint` ✅ (No ESLint warnings or errors)
- [x] `npm run build` ✅ (22/22 halaman, semua route API ter-compile)
- [ ] Apply migrasi `0009` & `0010` ke Supabase produksi — **butuh aksi user**
- [ ] E2E bot asli untuk `/laporan` & `/request` — **butuh aksi user**

---
- Validasi `/daftargrup` di group/channel Telegram asli (butuh aksi user: bot jadi admin, disable Group Privacy)
- Verifikasi domain pengirim Resend (user-dependent)
- Connect Git auto-deploy Vercel (opsional)
- UAT dengan pengguna asli + polish UI (Sprint 6–8)
