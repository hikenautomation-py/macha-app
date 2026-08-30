# Roadmap pengerjaan

Asumsi: 1 sprint = 2 minggu, tim kecil (1-2 developer). Sesuaikan durasi kalau tim/kapasitas berbeda. Urutan sengaja dibuat supaya tiap sprint menghasilkan sesuatu yang bisa didemokan, bukan menunggu semua selesai baru terlihat hasilnya.

> **STATUS UPDATE (2026-08-25)** — Dokumen ini adalah roadmap **asli** dari tahap perencanaan awal. Implementasi aktual memakai **Supabase (Postgres + Auth + Storage) + Vercel (Next.js App Router) + Telegram Bot + Resend** — lihat `ARCHITECTURE.md`. Stack ini yang dipakai untuk build.
>
> **STATUS UPDATE (2026-08-26)** — Web app live di **https://app.machapp.web.id**. Email notifikasi dari **Macha App \<notif.machapp.web.id\>**. Fitur **penautan Web ↔ Telegram via NPK** selesai: `/start` → NPK → cocokkan ke akun web (tertaut) atau lanjut registrasi (nama/golongan/title/email). Menunggu apply migrasi `0007` + deploy + E2E bot asli.
>
> **STATUS UPDATE (2026-08-28)** — Migrasi `0009`/`0010`/`0011` sudah di-apply ke Supabase produksi. Pick up laporan/request sudah bisa lewat Telegram (inline button); **pick up / assign dari web** (UI siap di `/tech` & `/dashboard`) kini lengkap — endpoint `POST /api/external/[id]/pickup` & `/assign` diimplementasi penuh via helper `createTaskFromExternal` di `lib/external.js` (lihat update 2026-08-30). Email laporan ke atasan masih terblokir DNS SPF `notif.machapp.web.id` (butuh setup/verifikasi domain Resend oleh user).
> **STATUS UPDATE (2026-08-30)** — **Pick up / assign laporan umum dari web selesai**: endpoint `POST /api/external/[id]/pickup` (semua user login) & `POST /api/external/[id]/assign` (atasan golongan ≥ 5; `assignedTo` harus di subtree bawahan) — keduanya via `lib/external.js` → `createTaskFromExternal` (guard anti double-pick + notif Telegram/email). Dokumentasi disinkron dengan stack aktual; `npm run lint` ✅ dan `npm run build` ✅ (2026-08-30).
>
> **STATUS UPDATE (2026-08-30, keamanan P0)** — **Self-declare level atasan diblokir**: `/api/signup`
> menolak klaim golongan ≥ 5 & jabatan SPV/ASM/SM (maks pelaksana `GOLONGAN_PELAKSANA_MAX = 4`);
> penetapan ke level atasan kini lewat endpoint baru `PATCH /api/users/{id}/role` (atasan terverifikasi,
> target di subtree, golongan < penyetuju). Alur Telegram ikut diperketat (`approveRegistration`
> memasar golongan final ke kapasitas penyetuju, klaim ≥ 5 perlu verifikasi). Lint & build ✅ (2026-08-30).
>
> **Progress per sprint:** Sprint 0–5 ✅ **SELESAI** (Sprint 2 & 5 kini termasuk teams/hierarki, laporan umum `/laporan` + `/request`, pick up Telegram, dan polish dashboard) · Sprint 6 🔄 **SEBAGIAN** (email + domain pengirim + penautan selesai; tes spam kantor menunggu verifikasi DNS Resend) · Sprint 7–8 ⬜ **BELUM MULAI**.
> Rincian per-item ada di `COMPLETED.md` (selesai) dan `TODOS.md` (sisa). Checkbox di bawah adalah roadmap historis dan tidak lagi mencerminkan stack/status aktual.

---

## Sprint 0 — Persiapan (1 minggu, sebelum sprint 1 dimulai)
**Tujuan**: semua akun dan akses siap sebelum coding dimulai.

- [x] Buat project Supabase (`pnpzkdyamjnxhujhbwjw`) + pasang environment variables dasar
- [ ] Buat bot Telegram lewat BotFather, simpan token
- [ ] Tentukan admin approval registrasi, dapatkan `chat_id`-nya
- [ ] Daftar akun email service (Resend/SendGrid)
- [ ] Setup repository, struktur folder, CI dasar (lint, format)
- [ ] Konfirmasi daftar nama, NPK, dan golongan seluruh anggota tim untuk data awal

**Output**: environment siap, tidak ada blocker akses di sprint berikutnya.

---

## Sprint 1 — Fondasi data & auth
**Tujuan**: struktur data dan login jalan, meskipun belum ada UI penuh.

- Setup PostgreSQL schema via migrasi Supabase (`users`, `pending_registrations`, `tasks`, `task_reports`, `task_problems`, `points_history` + RLS policies)
- Tulis security rules awal (lihat `DEVELOPER.md`)
- Setup Supabase Auth (email/password)
- Seed data dummy: beberapa user dengan golongan berbeda
- Deploy skeleton Next.js API routes di Vercel (belum ada logic, hanya "hello world" endpoint untuk validasi deployment jalan)

**Output**: bisa login ke Supabase Auth dan baca data dummy dari database lewat dashboard Supabase.

---

## Sprint 2 — Registrasi & approval Telegram
**Tujuan**: alur paling kritikal (siapa yang boleh pakai bot) selesai dan teruji.

- Implementasi webhook Telegram (`/telegramWebhook`)
- Alur `/start` → tanya nama/NPK/golongan → simpan ke `pending_registrations`
- Notifikasi ke admin dengan tombol inline Setujui/Tolak
- Implementasi `registerApprove` dan `registerReject`
- Testing end-to-end pakai akun Telegram asli tim (bukan cuma emulator)

**Output**: anggota tim beneran bisa `/start` bot dan admin bisa approve dari HP-nya.

---

## Sprint 3 — Task assignment & notifikasi
**Tujuan**: atasan bisa buat task, pelaksana dapat notifikasi.

- Endpoint `POST /tasks` + validasi golongan pembuat
- Trigger notifikasi Telegram otomatis saat task dibuat (`onTaskCreated`)
- Endpoint `GET /tasks?userId=` untuk dashboard technician
- Web dashboard: halaman list task technician (pakai desain dari mockup)
- Web dashboard: form buat task sederhana untuk atasan

**Output**: atasan bisa assign task dari dashboard, pelaksana dapat notif Telegram real-time.

---

## Sprint 4 — Completion report & approval poin
**Tujuan**: menutup loop utama aplikasi — ini sprint paling penting.

- Form completion report (web) sesuai mockup, termasuk upload foto ke Supabase Storage
- Endpoint `POST /tasks/{id}/reports`
- Dashboard atasan: daftar antrian approval
- Endpoint approve/reject dengan transaksi atomik (status + poin)
- Notifikasi hasil approval/reject ke pelaksana
- Testing skenario reject → revisi → submit ulang

**Output**: siklus penuh assigned → in_progress → report_submitted → approved bisa didemokan, poin bertambah otomatis.

---

## Sprint 5 — Problem report & statistik
**Tujuan**: fitur pendukung + mulai terlihat manfaat data historis.

- Form problem report (web + Telegram) dengan pilihan urgensi
- Notifikasi prioritas tinggi ke atasan (terpisah dari antrian completion report)
- Endpoint statistik (`/users/{id}/points`, `/teams/{id}/stats`)
- Dashboard atasan: metric card ringkasan + tabel statistik tim
- Dashboard technician: kartu "poin bulan ini"

**Output**: semua fitur inti dari deskripsi awal aplikasi sudah ada.

---

## Sprint 6 — Email notifikasi & polish
**Tujuan**: kanal tambahan + rapikan pengalaman pengguna.

- Integrasi email service, template notifikasi task baru & hasil approval
- Tes domain pengirim tidak masuk spam kantor
- Polish UI sesuai design token (warna, tipografi, ticket card) di semua halaman
- Empty state dan error state yang informatif (bukan pesan error mentah)
- Review keamanan: pastikan tidak ada write langsung ke `pointsHistory` dari client

**Output**: aplikasi terasa selesai, siap untuk UAT (user acceptance testing) internal.

---

## Sprint 7 — UAT & stabilisasi
**Tujuan**: uji dengan pengguna asli sebelum go-live penuh.

- Pilih 5-10 orang dari berbagai golongan untuk uji coba nyata selama sprint ini
- Kumpulkan feedback harian (bisa lewat grup Telegram terpisah)
- Perbaiki bug dan gesekan UX yang ditemukan
- Setup scheduled backup database
- Finalisasi budget alert dan monitoring (Usage Alerts Vercel + Spending Cap Supabase)

**Output**: aplikasi siap dipakai seluruh tim.

---

## Sprint 8 — Go-live & rollout bertahap
**Tujuan**: seluruh tim mulai pakai aplikasi.

- Rollout bertahap per line/section (bukan semua orang sekaligus)
- Sesi onboarding singkat, terutama cara `/start` bot dan cara submit laporan
- Pantau ketat minggu pertama, siap hotfix cepat
- Kumpulkan masukan untuk roadmap fase berikutnya (misal: kaizen tracking, integrasi FMEA/QCPC dari role SPV, gamifikasi tambahan)

---

## Ringkasan garis waktu

| Sprint | Fokus | Durasi kumulatif |
|---|---|---|
| 0 | Persiapan akun & akses | Minggu 1 |
| 1 | Fondasi data & auth | Minggu 2-3 |
| 2 | Registrasi & approval Telegram | Minggu 4-5 |
| 3 | Task assignment & notifikasi | Minggu 6-7 |
| 4 | Completion report & poin | Minggu 8-9 |
| 5 | Problem report & statistik | Minggu 10-11 |
| 6 | Email & polish UI | Minggu 12-13 |
| 7 | UAT & stabilisasi | Minggu 14-15 |
| 8 | Go-live bertahap | Minggu 16+ |

Total estimasi: **~16 minggu (4 bulan)** dari persiapan sampai go-live, dengan asumsi tim kecil dan tidak ada blocker eksternal (approval IT dsb, yang memang sudah diminimalkan lewat pilihan arsitektur cloud ini).

### Fitur yang sengaja ditunda ke fase berikutnya (di luar roadmap ini)
- Integrasi email dua arah / baca mailbox kantor (butuh approval IT pusat Jepang, biarkan jadi permintaan formal terpisah kalau dibutuhkan nanti)
- Gamifikasi lanjutan (leaderboard, badge pencapaian)
- Export laporan otomatis ke Excel/PDF untuk keperluan HR
- Integrasi dengan sistem FMEA/QCPC yang mungkin sudah ada di tim SPV
