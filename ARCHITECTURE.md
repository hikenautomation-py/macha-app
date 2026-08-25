# Architecture — Task Tracker Production Engineering

> Dokumen ini merangkum arsitektur aplikasi. Catatan penting: `PROJECT_BRIEF.md` awalnya menyebut **Firebase**, tetapi implementasi aktual (lihat `API_SPEC.md`, `DEVELOPER.md`, dan `apicredential.md`) telah dipindahkan ke **Supabase + Vercel**. Stack di bawah ini adalah yang dipakai untuk build.

---

## 1. Ringkasan

Aplikasi task tracker untuk tim Production Engineering dengan hierarki golongan:
- **Atasan**: Section Manager (golongan 7), Asisten SM (6), Supervisor (5)
- **Pelaksana**: Technician (1–4), Operator (1), Intern

Semua di-hosting di layanan cloud publik untuk menghindari birokrasi approval IT lokal. Pelaksana mengakses lewat HP pribadi (data seluler), atasan lewat internet kantor atau HP pribadi. Notifikasi lewat **Telegram bot** (channel utama, real-time, dua arah) dan **email kantor** (channel tambahan, satu arah).

---

## 2. Stack teknologi

| Layer | Teknologi | Keterangan |
|---|---|---|
| Hosting & edge | **Vercel** | Menyajikan web dashboard + Serverless Functions |
| Database | **Supabase PostgreSQL** | Skema relasional, RLS, Realtime |
| Autentikasi | **Supabase Auth** (email/password) | JWT dipakai untuk authorize API |
| Storage | **Supabase Storage** | Bucket `task-attachments` untuk foto lampiran |
| Backend logic | **Vercel Serverless Functions** (Next.js API routes) | Semua business logic & outbound call |
| Notifikasi | **Telegram Bot API** + **Email service** (Resend/SendGrid) | Telegram dua arah, email satu arah |
| Frontend | **Next.js (App Router) + React** | Mobile-first, design token custom |

### Mengapa Supabase + Vercel (bukan Firebase)
- `API_SPEC.md` dan `DEVELOPER.md` mendefinisikan endpoint sebagai Vercel Serverless Functions + PostgreSQL dengan Supabase Auth JWT.
- PostgreSQL cocok untuk relasi task → reports → points yang transaksional (approval = status + poin dalam satu transaksi).
- Supabase Realtime untuk dashboard auto-update; Storage untuk lampiran foto.
- Vercel Hobby + Supabase Free cukup untuk skala tim kecil-menengah.

---

## 3. Diagram arsitektur

```
┌──────────────────────────────────────────────────────────┐
│                        Vercel                             │
│  Next.js (web dashboard, mobile-first)                    │
│  Serverless Functions: /api/* (business logic, API)       │
└───────────────┬──────────────────────┬───────────────────┘
                │                      │
        ┌───────▼────────┐     ┌───────▼────────┐
        │ Supabase        │     │ Telegram Bot    │
        │  Postgres (RLS) │     │  API (webhook)  │
        │  Auth (JWT)     │     └───────┬────────┘
        │  Storage        │             │
        └───────┬─────────┘     ┌───────▼────────┐
                │               │ Email service  │
                │               │ (Resend)       │
                └───────────────┴────────────────┘
                        │
              ┌─────────┴──────────┐
              │ Pengguna: HP pribadi │
              │ (semua golongan)     │
              │ & email kantor       │
              └─────────────────────┘
```

---

## 4. Komponen

### Frontend (Next.js App Router)
- `app/` berisi halaman: login/registrasi, dashboard atasan, dashboard technician, form buat task, form lapor selesai, form lapor masalah.
- Mobile-first responsive — tampilan pelaksana dibungkus frame `phone` (max-width 380px); dashboard atasan layout desktop/wide.
- Design token terpusat di `app/globals.css` (lihat `DESIGN.md`).
- Autentikasi memakai Supabase Auth; JWT dikirim sebagai `Authorization: Bearer` ke API routes.

### Backend (Vercel Serverless Functions — Next.js route handlers)
- `app/api/*` menerjemahkan seluruh spesifikasi `API_SPEC.md`.
- Semua outbound call (Telegram API, email service, akses service role) berasal dari server, bukan device pengguna.
- Penulisan `points_history` **hanya** lewat server dengan `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS), agar poin tidak bisa dimanipulasi dari client.

### Database (Supabase PostgreSQL)
Lihat `supabase/migrations/0001_initial_schema.sql`. Tabel: `users`, `pending_registrations`, `tasks`, `task_reports`, `task_problems`, `points_history`.

### Autentikasi
- Supabase Auth (email/password) untuk login web dashboard.
- `telegram_chat_id` sebagai identitas alternatif untuk interaksi via bot, divalidasi lewat proses approval admin.
- Verifikasi JWT di API routes memakai `@supabase/supabase-js` `auth.getUser(token)`.

### Notifikasi
- **Telegram Bot API** — channel utama, real-time, dua arah (kirim notif + terima callback button).
- **Email service** — channel tambahan satu arah (task baru, hasil approval), khusus atasan.

---

## 5. State machine task

```
assigned ──▶ in_progress ──▶ report_submitted ──▶ approved  (poin ditambahkan)
                              │
                              └──▶ rejected ──▶ in_progress
```

Status enum: `assigned` → `in_progress` → `report_submitted` → `approved` / `rejected`.

---

## 6. Alur utama

1. **Registrasi Telegram**: user `/start` → isi nama/NIK/golongan → `pending_registrations` → admin tap inline button Setujui/Tolak → `registerApprove` memindahkan ke `users`.
2. **Assign task**: atasan (golongan ≥ 5) `POST /api/tasks` → task `assigned` → notif Telegram (+ email) ke pelaksana.
3. **Kerjakan**: technician buka dashboard → lihat task → ubah status / submit completion report.
4. **Approval**: `POST /api/tasks/{id}/reports/{reportId}/approve` → transaksi atomik (status → `approved` + insert `points_history`) → notif pelaksana.
5. **Problem**: `POST /api/tasks/{id}/problems` → notif prioritas tinggi langsung ke atasan (tanpa antrian approval).

---

## 7. Struktur direktori

```
macha-app/
├── app/
│   ├── layout.js            # root layout, CSS (system font, tanpa Google Fonts)
│   ├── globals.css          # design tokens & komponen
│   ├── page.js              # landing → redirect login/dashboard
│   ├── login/page.js        # login & registrasi web
│   ├── dashboard/page.js    # dashboard atasan
│   ├── tech/page.js         # dashboard technician
│   ├── tasks/new/page.js    # form buat task (atasan)
│   ├── tasks/[id]/complete/page.js
│   ├── tasks/[id]/problem/page.js
│   └── api/                 # Vercel Serverless Functions
│       ├── registerRequest/route.js
│       ├── registerApprove/route.js
│       ├── registerReject/route.js
│       ├── tasks/route.js               # POST & GET
│       ├── tasks/pendingApproval/route.js
│       ├── tasks/[id]/status/route.js   # PATCH
│       ├── tasks/[id]/reports/route.js
│       ├── tasks/[id]/reports/[reportId]/approve/route.js
│       ├── tasks/[id]/reports/[reportId]/reject/route.js
│       ├── tasks/[id]/problems/route.js
│       ├── tasks/[id]/problems/[problemId]/resolve/route.js
│       ├── users/[id]/points/route.js
│       ├── teams/[id]/stats/route.js
│       └── telegramWebhook/route.js
├── components/             # TicketCard, Badge, MetricCard, dst.
├── lib/
│   ├── supabase.js         # client browser + server + admin
│   ├── auth.js             # helper verifikasi JWT + golongan
│   └── telegram.js         # helper kirim pesan / edit keyboard
├── supabase/migrations/    # SQL schema + RLS
├── ARCHITECTURE.md / DESIGN.md / API_SPEC.md / DEVELOPER.md
├── PROJECT_BRIEF.md / ROADMAP.md / TODOS.md / COMPLETED.md
└── apicredential.md
```

---

## 8. Environment variables

| Variable | Scope | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | service role (RAHASIA) |
| `TELEGRAM_BOT_TOKEN` | server | token bot Telegram |
| `TELEGRAM_ADMIN_CHAT_ID` | server | chat id admin approval |
| `TELEGRAM_WEBHOOK_SECRET` | server | secret token validasi webhook Telegram |
| `EMAIL_API_KEY` | server | API key Resend/SendGrid |
| `EMAIL_FROM` | server | alamat pengirim notifikasi |

Lihat `apicredential.md` untuk daftar lengkap + placeholder yang perlu diisi.
