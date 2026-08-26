# Task tracker — production engineering team

> **STATUS UPDATE (2026-08-26)** — Implementasi aktual memakai **Supabase (Postgres + Auth + Storage) + Vercel (Next.js)** — lihat `ARCHITECTURE.md`. Web app live di **https://app.machapp.web.id**. Email notifikasi dikirim dari **Macha App \<notif.machapp.web.id\>** (Resend). Akun **web ↔ Telegram dihubungkan lewat NPK** sebagai kunci unik: cukup ketik NPK di bot Telegram saat `/start` untuk langsung menautkan notifikasi ke akun web yang sudah terdaftar. Rincian flow & endpoint ada di `API_SPEC.md` / `SETUP_TELEGRAM.md`.

## 1. Project brief

### Latar belakang
Section Manager Production Engineering saat ini kesulitan mendistribusikan dan memantau pekerjaan tim secara terukur. Tugas dari golongan atas (SM, ASM, SPV) ke golongan bawah (Technician, Operator, Intern) masih diberikan secara ad-hoc, penilaian kinerja bersifat intuitif/subjektif, dan golongan bawah sering tidak tahu harus mengerjakan apa di awal hari.

### Masalah yang diselesaikan
| Masalah | Solusi di app |
|---|---|
| Hierarki tugas membingungkan | Task punya `assigned_by` dan `assigned_to` yang eksplisit, terikat golongan |
| Penilaian kinerja tidak terukur | Setiap task punya bobot poin, poin masuk otomatis saat completion di-approve |
| Golongan bawah bingung mau kerja apa | Dashboard harian menampilkan daftar task aktif per orang |
| Tidak ada jadwal jelas | Setiap task punya deadline, terlihat di dashboard dan notifikasi |
| Masalah di lapangan lambat naik ke atasan | Jalur problem report terpisah, notifikasi langsung, tidak antre seperti completion report |

### Target pengguna
- **Atasan** (SM golongan 7, ASM golongan 6, SPV golongan 5) — assign task, approve completion report, pantau statistik tim. Punya akses internet kantor.
- **Pelaksana** (Technician golongan 1-4, Operator golongan 1, Intern) — terima task, submit completion report, submit problem report. Akses via HP pribadi (data seluler), tidak selalu punya akses internet kantor.

### Kanal interaksi
- **Web dashboard** (semua golongan, akses via browser di HP atau PC pribadi) — live di `https://app.machapp.web.id`
- **Telegram bot** (notifikasi real-time + interaksi cepat, khususnya untuk golongan pelaksana) — `/start` + NPK untuk menautkan akun web, atau registrasi baru (nama → golongan → title → email)
- **Email kantor** (notifikasi tambahan untuk atasan, satu arah — masuk ke inbox kantor, tidak butuh approval IT pusat karena bukan akses keluar domain) — dikirim dari `Macha App <notif.machapp.web.id>` via Resend
- **Web ↔ Telegram** — NPK adalah kunci unik penghubung: akun yang sudah terdaftar di web bisa langsung menautkan chat Telegram tanpa registrasi ulang

### Batasan yang membentuk arsitektur
- Internet kantor (jaringan kantor/PC) hanya untuk golongan 6 ke atas — tim engineering dibebaskan pakai HP pribadi dengan kuota sendiri, sehingga ini bukan blocker.
- Email kantor diatur ketat oleh IT pusat Jepang — hanya kirim notifikasi masuk yang dilakukan, tidak ada integrasi baca/kirim dari akun kantor.
- Hosting dan backend menggunakan layanan cloud (Firebase) untuk menghindari birokrasi approval IT lokal atas server on-premise.

---

## 2. Design tokens

### Warna
| Token | Hex | Penggunaan |
|---|---|---|
| `--bg` | `#F3F7F1` | Latar halaman |
| `--surface` | `#FFFFFF` | Card, permukaan utama |
| `--surface-tint` | `#EEF4EC` | Card sekunder, metric block |
| `--ink` | `#1E2B24` | Teks utama |
| `--ink-soft` | `#5C6E63` | Teks sekunder |
| `--ink-faint` | `#8A998F` | Placeholder, teks pasif |
| `--border` | `#DFE8DC` | Garis pembatas |
| `--teal` | `#2F6F62` | Warna brand utama, tombol primer, header |
| `--teal-dark` | `#1F4E44` | Hover state, gradient |
| `--teal-tint` | `#E1EFEA` | Badge status "assigned", latar lembut |
| `--amber` | `#F2A93B` | Poin, elemen penghargaan/reward |
| `--amber-tint` | `#FDF0DB` | Latar badge "menunggu approval" |
| `--amber-ink` | `#8A5A0B` | Teks di atas amber tint |
| `--coral` | `#E8674B` | Warning, problem report |
| `--coral-tint` | `#FBE7E1` | Latar badge/section masalah |
| `--coral-ink` | `#A33A22` | Teks di atas coral tint |
| `--sky` | `#4F91C7` | Badge status "in progress" |
| `--sky-tint` | `#E6F0F8` | Latar info netral |

### Tipografi
| Role | Font | Penggunaan |
|---|---|---|
| Display / heading | `Baloo 2` (500/600/700) | Judul halaman, judul task, greeting |
| Body | `Plus Jakarta Sans` (400/500/600/700) | Paragraf, label, tombol |
| Data / angka | `JetBrains Mono` (500/600) | Poin, NPK, angka statistik |

### Layout & bentuk
- Radius card: `20px` — radius kontrol/input: `12px` — badge/pill: `999px` (full round)
- Card utama: border `1px solid var(--border)`, tanpa shadow default; shadow hanya muncul saat hover pada elemen interaktif (ticket card)
- Elemen signature: **ticket card** — task ditampilkan sebagai tiket dengan garis putus-putus dan "stub" berisi poin, meniru bentuk tiket fisik
- Mobile-first untuk semua tampilan yang diakses golongan pelaksana (max-width 380px, dibungkus frame `phone`)
- Desktop/wide layout untuk dashboard atasan

### Prinsip UI
- Warna status selalu konsisten: teal = assigned, sky = in progress, amber = menunggu approval, coral = problem/danger
- Microcopy percakapan, bukan formal kaku — contoh: "Yuk mulai, kenalan dulu", "Semangat hari ini!"
- Tidak ada elemen yang memberi kesan tekanan (tidak ada countdown merah mencolok, tidak ada red badge angka besar kecuali untuk problem report yang memang harus menonjol)

---

## 3. Deskripsi fitur per halaman

### Registrasi & approval Telegram
User baru kirim `/start` ke bot → isi nama, NPK, golongan → status `pending` → admin telegram dapat notifikasi dengan tombol inline Setujui/Tolak → jika disetujui, `chat_id` terhubung ke akun user di database.

### Dashboard atasan
Ringkasan metrik (task aktif, menunggu approval, problem report, total poin tim), daftar antrian approval, tabel statistik kinerja tim per individu. Tombol "Buat task baru" untuk assign task ke bawahan.

### Dashboard technician/operator
Sapaan personal, daftar task hari ini dengan status berwarna, dua tombol aksi utama (Lapor selesai / Lapor masalah), ringkasan poin bulan berjalan di bagian bawah (bukan fokus utama).

### Form lapor selesai (completion report)
Field: catatan progress (wajib), lampiran foto (opsional). Submit mengubah status task menjadi `report_submitted`, menunggu approval atasan. Setelah approve, poin otomatis masuk ke `points_history`.

### Form lapor masalah (problem report)
Field: tingkat urgensi (bisa nunggu / perlu hari ini / mendesak), deskripsi masalah (wajib). Jalur notifikasi terpisah dari completion report — langsung ke atasan tanpa antrian biasa, karena tujuannya keputusan cepat.

---

## 4. Architecture

### Ringkasan
Aplikasi di-hosting sepenuhnya di layanan cloud (Firebase) untuk menghindari proses approval IT lokal yang panjang. Golongan pelaksana mengakses lewat browser HP pribadi (data seluler), golongan atasan lewat internet kantor atau HP pribadi. Notifikasi dikirim lewat Telegram bot (channel utama, real-time) dan email kantor (channel tambahan, satu arah).

```
┌─────────────────────────────────────────────────┐
│                 Vercel project                  │
│                                                 │
│  Hosting (web dashboard)                        │
│  Cloud Functions (API, business logic)          │
│  Firestore (database)                           │
│  Firebase Auth (login)                          │
└───────────────┬──────────────────┬──────────────┘
                │                  │
        ┌───────▼───────┐   ┌──────▼────────┐
        │ Telegram Bot  │   │ Email service │
        │ API           │   │ (Resend/Gmail)│
        └───────┬───────┘   └──────┬────-───┘
                │                  │
      ┌─────────▼─────────┐  ┌─────▼───────┐
      │ HP pribadi        │  │ Email kantor│
      │ (semua golongan,  │  │ (semua      │
      │  data seluler)    │  │  golongan)  │
      └───────────────────┘  └─────────────┘
```

### Komponen

**Frontend**
- Web app (React atau HTML/JS ringan), di-hosting di Firebase Hosting
- Mobile-first responsive, karena mayoritas pengguna akses via HP

**Backend**
- Firebase Cloud Functions sebagai API layer — menangani logic assign task, approval, kalkulasi poin, webhook Telegram
- Semua outbound call (Telegram API, email service) berasal dari server Cloud Functions, tidak dari device pengguna, sehingga tidak terikat batasan internet kantor

**Database — Firestore**
- `users/{userId}` — profil, golongan, `telegram_chat_id`, referensi atasan
- `pending_registrations/{chatId}` — user yang menunggu approval admin telegram
- `tasks/{taskId}` — task individual dengan status, bobot poin, deadline
- `tasks/{taskId}/reports/{reportId}` — subcollection completion report per task
- `tasks/{taskId}/problems/{problemId}` — subcollection problem report per task
- `pointsHistory/{entryId}` — log poin, collection root karena sering di-query lintas task

**Autentikasi**
- Firebase Auth untuk login web dashboard (email/password atau custom token yang dipetakan dari NPK)
- Telegram chat_id sebagai identitas alternatif untuk interaksi via bot, divalidasi lewat proses approval admin

**Notifikasi**
- Telegram Bot API — channel utama, real-time, dua arah (kirim & terima balasan)
- Email service (Resend/SendGrid/Gmail API) — channel tambahan, satu arah, terutama untuk atasan

**State machine task**
```
assigned → in_progress → report_submitted → approved (poin ditambahkan)
                                          → rejected → kembali ke in_progress
```

### Kenapa arsitektur ini dipilih
- **Tidak butuh approval IT lokal** untuk hosting server, karena semuanya di cloud publik
- **Tidak butuh approval IT pusat Jepang**, karena tidak menyentuh mailbox kantor — hanya kirim email masuk biasa
- **Tidak terikat pembatasan internet kantor**, karena semua akses lewat HP pribadi dengan kuota sendiri
- **Firestore + Cloud Functions** dipilih atas SQL karena skema masih akan berkembang di tahap awal, real-time listener bagus untuk dashboard yang auto-update, dan tier gratis cukup untuk skala tim kecil-menengah
