# QA checklist — potensi kegagalan sistem

Dokumen ini berisi skenario kegagalan yang relevan untuk diuji, dikelompokkan berdasarkan prioritas sesuai arsitektur aktual project (Next.js di Vercel, Supabase, Telegram bot, Resend, domain custom `machapp.web.id`). Gunakan kolom **Status** untuk tracking saat proses testing berjalan.

Legenda prioritas: 🔴 Tinggi (wajib diuji sebelum go-live) — 🟡 Sedang (uji kalau ada waktu, atau setelah fitur terkait dibangun) — ⚪ Rendah/tidak relevan (belum berlaku di arsitektur saat ini)

---

## 1. Integrasi eksternal & network

| # | Kegagalan | Prioritas | Skenario test | Perilaku yang diharapkan | Status |
|---|---|---|---|---|---|
| 1.1 | Webhook error | 🔴 | Kirim payload malformed ke `/api/telegram-webhook`; simulasikan Telegram mengirim ulang (retry) saat endpoint sedang down | Endpoint tidak crash, mengembalikan status code yang sesuai supaya Telegram tahu harus retry atau tidak; tidak ada data korup di database | ☐ |
| 1.2 | Push notification gagal | 🔴 | Kirim notifikasi ke `chat_id` yang sudah block bot, atau `chat_id` tidak valid | Task tetap ter-assign di database meski notifikasi gagal; ada log error, tidak membuat seluruh request gagal total | ☐ |
| 1.3 | External API timeout | 🔴 | Simulasikan Telegram API / Resend API lambat merespons (mock delay 30 detik+) | Request pengguna tidak ikut hang selamanya; ada timeout wajar (misal 10 detik) dengan pesan error yang jelas | ☐ |
| 1.4 | CORS | 🔴 | Akses dashboard dari `app.machapp.web.id`, pastikan call ke Supabase tidak diblok browser | Tidak ada error CORS di console; domain custom sudah terdaftar di Supabase Auth URL Configuration | ☐ |
| 1.5 | DNS drama | 🔴 | Cek propagasi record setelah setup domain; test perubahan nameserver kalau pindah ke Cloudflare | Semua record (SPF, DKIM, CNAME) terverifikasi dengan benar; tidak ada downtime tak terduga saat migrasi | ☐ |
| 1.6 | Redirect loop | 🟡 | *Kondisional*: kalau domain dipindah ke Cloudflare proxy, test akses via HTTP dan HTTPS | Tidak ada infinite redirect; SSL/TLS mode Cloudflare di-set "Full" atau "Full (strict)", bukan "Flexible" | ☐ |
| 1.7 | SSL expired | 🟡 | Cek status SSL certificate domain custom secara berkala | Vercel auto-renew SSL selama DNS masih benar; alert kalau ada perubahan nameserver yang bisa mengganggu renewal | ☐ |
| 1.8 | CDN nggak update | 🟡 | *Kondisional*: kalau pakai Cloudflare dengan proxy aktif, deploy versi baru lalu cek apakah user langsung lihat perubahan | User melihat versi terbaru setelah deploy; kalau tidak, cek cache purge Cloudflare otomatis/manual | ☐ |

---

## 2. Autentikasi & sesi

| # | Kegagalan | Prioritas | Skenario test | Perilaku yang diharapkan | Status |
|---|---|---|---|---|---|
| 2.1 | JWT invalid | 🔴 | Akses dashboard dengan token Supabase yang sudah expired/rusak | Redirect otomatis ke halaman login, bukan error 500 atau halaman blank | ☐ |
| 2.2 | Session logout sendiri | 🔴 | Buka dashboard, biarkan idle beberapa jam, cek apakah sesi masih hidup | Sesi bertahan sesuai durasi yang dikonfigurasi, tidak logout tiba-tiba akibat bug cookie/refresh token | ☐ |
| 2.3 | Cookie nggak ke-set | 🔴 | Test login dari berbagai browser, terutama Safari (lebih strict soal cookie pihak ketiga) | Cookie sesi ter-set dengan benar (`SameSite`, `Secure`) di semua browser utama | ☐ |

---

## 3. Data & database

| # | Kegagalan | Prioritas | Skenario test | Perilaku yang diharapkan | Status |
|---|---|---|---|---|---|
| 3.1 | Duplicate data | 🔴 | Klik tombol "Kirim untuk approval" 2x cepat berturut-turut; kirim ulang payload webhook Telegram yang identik | Hanya 1 completion report / 1 registrasi yang tersimpan, bukan duplikat | ☐ |
| 3.2 | DB timeout | 🔴 | Load test beberapa request bersamaan ke endpoint yang query database | Tidak kehabisan koneksi Postgres; pastikan pakai Supabase connection pooler, bukan direct connection | ☐ |
| 3.3 | N+1 query | 🔴 | Cek query log Supabase saat load halaman statistik tim | Statistik tim di-load dengan 1 query JOIN, bukan 1 query berulang per user | ☐ |
| 3.4 | Deadlock | 🔴 | 2 atasan approve/reject task yang saling terkait secara bersamaan | Function `approve_report` tetap konsisten, tidak ada dua kali insert poin atau state korup | ☐ |
| 3.5 | Null pointer | 🔴 | Buat task untuk user tanpa `atasan_id` terisi; akses field yang mungkin kosong (`golongan`, `email_kantor`) | Tidak crash; ada validasi/fallback yang jelas saat data belum lengkap | ☐ |
| 3.6 | Infinite loop (logika status) | 🔴 | Reject task yang sama berkali-kali secara berturut-turut | State machine tidak tersangkut; tidak ada notifikasi spam berulang tanpa henti | ☐ |
| 3.7 | Double-pick laporan/request | 🔴 | Dua user (web & Telegram) menekan Pick up pada laporan yang sama dalam detik yang sama | Hanya satu task tercipta; `external_requests.status` jadi `picked` sekali; user yang kalah dapat pesan `ALREADY_PICKED` (guard `.eq('status','open')` di `createTaskFromExternal`) | ☐ |
| 3.8 | Assign lintas subtree | 🔴 | Atasan mencoba `POST /api/external/{id}/assign` dengan `assignedTo` di luar subtree bawahan-nya | Endpoint mengembalikan `403 PERMISSION_DENIED`; tidak ada task tercipta | ☐ |

---

## 4. UI & rendering

| # | Kegagalan | Prioritas | Skenario test | Perilaku yang diharapkan | Status |
|---|---|---|---|---|---|
| 4.1 | Page render salah implementasi | 🟡 | Login sebagai tiap golongan (Technician, Operator, SPV, ASM, SM), cek elemen yang muncul | Technician/Operator tidak pernah melihat tombol approve; role-based UI konsisten di semua halaman | ☐ |
| 4.2 | Memory leak (realtime subscription) | 🟡 | Buka dashboard, pindah halaman berkali-kali tanpa reload penuh, cek penggunaan memori browser | Realtime subscription Supabase di-unsubscribe saat komponen unmount, tidak menumpuk | ☐ |
| 4.3 | Cache expired | 🟡 | *Kondisional*: kalau pakai Next.js ISR/fetch cache untuk data dashboard | Data task/approval terbaru tidak collision dengan cache statis; user tidak lihat data basi | ☐ |

---

## 5. Belum relevan di arsitektur saat ini

Item berikut **tidak perlu masuk skenario test sekarang** karena komponen terkait belum ada di stack (Vercel + Supabase + Telegram + Resend, tanpa background job/worker terpisah). Simpan sebagai catatan untuk revisit kalau arsitektur berkembang.

| # | Kegagalan | Kapan jadi relevan |
|---|---|---|
| 5.1 | Redis down | Kalau nanti ditambahkan caching layer terpisah atau session store berbasis Redis |
| 5.2 | Queue stuck | Kalau nanti ada background job/message queue (misal proses laporan besar secara async) |
| 5.3 | Worker mati | Kalau nanti ada long-running worker process di luar serverless function Vercel |
| 5.4 | Cronjob nggak jalan | Kalau nanti diimplementasi reminder otomatis pakai Vercel Cron atau `pg_cron` Supabase |

---

## Ringkasan prioritas untuk sprint UAT (Sprint 7 di `ROADMAP.md`)

- **🔴 Wajib selesai sebelum go-live**: 16 skenario (integrasi eksternal, autentikasi, integritas data, double-pick laporan)
- **🟡 Diuji kalau waktu memungkinkan**: 5 skenario (kondisional tergantung fitur/infra tambahan)
- **⚪ Ditunda**: 4 skenario (belum relevan sampai arsitektur berkembang)

Rekomendasi: alokasikan 2-3 hari khusus di Sprint 7 untuk menjalankan seluruh skenario 🔴 secara sistematis sebelum rollout bertahap ke tim.
