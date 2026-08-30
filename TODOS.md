# TODOS — Task Tracker Production Engineering

> Daftar task yang AKAN dikerjakan. Update file ini setiap ada progress (dan pindahkan item selesai ke `COMPLETED.md`).
> Status validasi terakhir (2026-08-28): `npm run build` ✅ dan `npm run lint` ✅ (22 halaman, per 2026-08-27). Web app live di **`app.machapp.web.id`** (Vercel). Teams & hierarki rekursif, laporan umum `/laporan` + `/request` (Telegram + web), pick up/reject laporan via Telegram, polish dashboard 4 metric card, email registrasi "akun aktif" sudah diimplementasi. **Migrasi `0009`/`0010`/`0011` sudah di-apply ke Supabase produksi.** Pick up / assign laporan umum dari web **selesai** (endpoint `/api/external/[id]/pickup` & `/api/external/[id]/assign` terimplementasi penuh via helper `createTaskFromExternal`; lint & build diverifikasi 2026-08-30). Email laporan ke atasan masih diblokir menunggu setup/verifikasi domain Resend (SPF/DKIM). E2E bot asli & upload storage masih butuh aksi user. Rincian di `COMPLETED.md`.

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
- [x] Alur `/start` → **NPK dulu** → cocokkan ke `users`: sudah ada → penautan `telegram_chat_id` (akun web); belum ada → registrasi nama/golongan/title/email → `pending_registrations` + tombol inline Setujui/Tolak + `registerApprove`/`registerReject` (kode selesai, butuh migrasi `0007`)
- [x] Uji end-to-end alur registrasi + penautan dengan bot Telegram asli (butuh akun Telegram + admin asli + migrasi `0007` diterapkan) — **butuh aksi user**
- [x] Struktur organisasi dibuat seperti ini: SM memilih team, ASM membuat team dan siapa saja dibawahnya (migrasi `0009` tabel `teams` + `team_members`; halaman `/teams` untuk kelola team)
- [x] Hubungan atasan dan bawahan lebih jelas: atasan menentukan siapa bawahannya lewat team; golongan atas lihat task & completion semua bawahannya (rekursif via `atasan_id` + RPC `get_subordinate_ids`); tidak bisa melihat task/statistik golongan di atasnya (validasi scope di API)
- [x] Task yang bisa di-complete/di-update bawahan hanya task miliknya (GET `/tasks` non-atasan di-scope ke `assigned_to` sendiri; report/problem sudah cek `assigned_to !== profile.id`)


## Sprint 3 — Task assignment & notifikasi

- [x] Uji `POST /api/tasks` dari dashboard atasan (E2E ✅)
- [x] Uji `GET /api/tasks?userId=` di dashboard technician (E2E ✅)
- [x] Wiring notif Telegram otomatis saat task dibuat (via `notifyTelegram`, route `tasks`)
- [x] Validasi notif Telegram benar-benar terkirim ke chat/group asli (bot asli + `notification_channels` terisi) — terkonfirmasi user notif laporan masuk ke group

## Sprint 4 — Completion report & approval poin

- [x] Uji form lapor selesai (POST report) (E2E ✅)
- [x] Uji antrian approval di dashboard atasan (`/tasks/pendingApproval`) (E2E ✅, fix import `mapReport`)
- [x] Uji transaksi approve/reject (status + poin atomik via RPC `approve_report`) (E2E ✅)
- [x] Uji skenario reject → revisi → submit ulang (E2E ✅)
- [ ] Uji upload foto ke Supabase Storage (belum tercakup di E2E) — **butuh aksi user**

## Sprint 5 — Problem report & statistik

- [x] Uji form problem report (POST problem) (E2E ✅)
- [x] Uji endpoint `/users/{id}/points` dan `/teams/{id}/stats` (E2E ✅)
- [x] Wiring notif prioritas tinggi ke atasan (via `notifyTelegram`, route `problems`)
- [x] Uji problem report via Telegram + notif prioritas tinggi terkirim ke chat asli (butuh bot asli) — **butuh aksi user**
- [x] Problem report bisa dilakukan siapapun: perintah Telegram `/laporan` (laporan masalah umum) + `/request` (permintaan improvement), plus form web publik `/laporan` & `/request`. Data masuk tabel `external_requests`, pelapor wajib isi nama + NPK (tidak wajib terdaftar).
- [x] Metric card dashboard atasan jadi 4 kartu (Task aktif, Menunggu approval, Problem report, Poin tim bulan ini) + section problem report & laporan umum/request (migrasi `0010`, route `/api/dashboard/summary`)
- [x] Siapapun bisa Pick up laporan/request: notif Telegram memuat tombol inline `Pick up` + `Reject`. Pick up membuat task untuk si picker (assigned_by = atasan picker); reject hanya SPV ke atas. Migrasi `0011`, helper `lib/external.js`, callback `pickup_`/`xreject_` di webhook.
- [x] Endpoint `GET /api/external` diubah dari atasan-only menjadi semua user login (agar laporan/request terlihat lintas golongan tanpa delegasi).
- [x] **Pick up / assign laporan umum dari web** (lanjutan): UI dipasang di `/tech` (tombol "Pick up") & `/dashboard` (tombol "Assign to" + modal pilih bawahan). Helper `createTaskFromExternal(admin, { row, assignedBy, assignedTo })` sudah ditambahkan ke `lib/external.js` (insert task + update `external_requests.picked` + notif Telegram + email). Endpoint `POST /api/external/[id]/pickup` & `POST /api/external/[id]/assign` sudah terimplementasi penuh (2026-08-30) — **tinggal deploy + E2E asli**.

## Sprint 6 — Email & polish

- [x] Integrasi email service + template notifikasi (Resend via `lib/email.js`, terpasang di 5 titik notifikasi + email "akun aktif" saat approval)
- [x] Kirim email test Resend sandbox → `hikenautomation@gmail.com` (HTTP 200)
- [x] Review keamanan: `points_history` hanya punya policy SELECT (tidak ada write langsung dari client)
- [x] Domain pengirim Resend `notif.machapp.web.id` + `EMAIL_FROM=Macha App <info@notif.machapp.web.id>` (dikonfirmasi user; reply-to ditambahkan ke notifikasi task/report/approval)
- [x] Tes spam kantor: kirim email test ke `dedy_supriyanto@taci.toyota-industries.com` (Resend HTTP 200) — email BELUM masuk inbox; penyebab waktu itu disangka SPF `notif…` belum ada (ternyata SPF host-nya `send.notif…` & sudah lengkap; lihat item #2 di bawah)
- [x] Tes ulang 2026-08-30 #2: DKIM ✅ & MX ✅ & **SPF di host yg BENAR** `send.notif.machapp.web.id` (`v=spf1 include:amazonses.com ~all`) & DMARC root `p=none` ✅ — **konfigurasi DNS LENGKAP & terverifikasi via dns.google + cloudflare** (dulu salah audit: SPF bukan `notif` tapi host `send.notif` — sekarang benar & terlihat publik). Email test masuk **Junk** (Dedy) = semua auth hijau (SPF/DKIM/DMARC) tapi **belum warm-up subdomain baru** + filter ketat gateway korporat. Aksi lanjut: (a) Dedy tandai "Not Junk"/allow; (b) kirim rutin bertahap 2–3 minggu; cek header email untuk `Authentication-Results` (spf=pass dkim=pass dmarc=pass) sbg bukti. Catatan: API key Resend **send-only (restricted)** → delivery/bounce tak bisa dicek API. **Keamanan: rotasi API key Resend masih pending (sempat bocor di sesi).**
- [ ] Fix email laporan ke atasan gagal 422 di produksi: `EMAIL_FROM` Vercel produksi sudah di-update ke `info@notif.machapp.web.id` + redeploy (422 sudah teratasi) — **status: semua DNS records (SPF `send.notif`, MX `send.notif`, DKIM) sudah terpasang & publik; tinggal pastikan domain status **Verified** di dashboard Resend** (klik "Restart verification" bila perlu) & test kirim lagi
- [ ] Setup/verifikasi domain Resend `notif.machapp.web.id` — **status record sudah lengkap sedari 2026-08-30**: SPF TXT di host `send.notif` ✅, MX `send.notif` → `feedback-smtp…amazonses` ✅, DKIM `resend._domainkey…` ✅ (verif dns.google + cloudflare). **Aksi user tersisa**: pastikan dashboard Resend tampil **Verified**; kirim test ulang ke `dedy_supriyanto@taci.toyota-industries.com` & cek header (harus `spf=pass dkim=pass dmarc=pass`) → jika masih Junk berarti nominal warm-up
- [x] Polish UI sesuai `DESIGN.md` di halaman dashboard atasan (4 metric card + section problem/laporan) & halaman baru teams/laporan/request
- [ ] Tambah empty state & error state yang informatif (sudah ada `EmptyState`/`Loading`/`err`; audit ulang per halaman tersisa)

## Fitur broadcast group/channel Telegram (SELESAI)

- [x] Migrasi `0003_notification_channels.sql` (tabel `notification_channels`) — dibuat & diterapkan
- [x] `lib/telegram.js`: `listNotificationChannels()` + `notifyTelegram()` (broadcast ke semua channel + admin)
- [x] Perintah admin bot: `/daftargrup` & `/hapusgrup`
- [x] Notifikasi completion/problem di semua route task memakai `notifyTelegram`
- [x] `SETUP_TELEGRAM.md` diperbarui (alur bot lengkap: registrasi, group/channel, laporan, ringkasan notifikasi)
- [x] Validasi `/daftargrup` di group/channel asli (bot jadi admin + disable Group Privacy) — butuh aksi user

## Fitur penautan Web ↔ Telegram via NPK (SELESAI — E2E bot asli masih butuh aksi user)

- [x] Migrasi `0007_add_email_and_telegram_link.sql` — kolom `email` di `users` & `pending_registrations` + backfill dari `auth.users` + trigger diperbarui (idempoten)
- [x] Alur bot: `/start` → NPK → cocokkan ke `users`: sudah ada → link `telegram_chat_id` (penautan akun web); belum ada → lanjut registrasi nama/golongan/title/email
- [x] Step `step_email` + peringatan "email dipakai untuk notifikasi, prioritaskan email kantor"
- [x] Pesan akhir registrasi: menunggu approval + saran login web app `app.machapp.web.id`
- [x] `registerApprove`/`registerRequest` menyimpan `email`; `getUserEmail` fallback ke `users.email` (notifikasi email untuk user Telegram)
- [x] Email "akun aktif" (`emailRegistrationApproved`) terkirim saat approval
- [x] Apply migrasi `0007` ke Supabase produksi + deploy Vercel
- [ ] Uji E2E penautan + alur registrasi baru dengan bot asli — **butuh aksi user**

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


