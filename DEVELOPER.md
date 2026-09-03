# Developer setup guide

Panduan ini untuk developer yang akan mulai implementasi. Urutan pengerjaan disusun supaya bisa langsung dites tiap tahap, bukan menunggu semua selesai baru bisa dicoba.

---

## 1. Persiapan Supabase + Vercel

### 1.1 Buat project

#### Supabase
1. Buka [app.supabase.com](https://app.supabase.com), login, klik **New project**
2. Pilih organization, beri nama project, misal `task-tracker-engineering`
3. Set password database (simpan baik-baik, tidak boleh commit)
4. Pilih region terdekat, misal **Asia Pacific (Singapore)** atau region yang paling dekat dengan lokasi tim
5. Tunggu provisioning selesai (biasanya < 2 menit)

#### Vercel
1. Buka [vercel.com](https://vercel.com), login dengan akun GitHub
2. Klik **Add New → Project**
3. Import repository project ini (atau buat empty project dan deploy nanti)
4. Set framework preset (misal Next.js, Vite, atau React)
5. Setelah project dibuat, catat **Project ID** dan **Deployment URL**

### 1.2 Aktifkan layanan yang dibutuhkan

Di Supabase dan Vercel, aktifkan konfigurasi dasar:

| Layanan | Platform | Setting awal |
|---|---|---|
| Database (PostgreSQL) | Supabase → Database | Sudah aktif otomatis, siapkan schema di bagian 1.4 |
| Authentication | Supabase → Auth | Aktifkan provider **Email/Password** (atau magic link) |
| Storage | Supabase → Storage | Buat bucket untuk lampiran foto, misal `task-attachments` |
| Realtime | Supabase → Realtime | Aktif (default) untuk dashboard auto-update |
| Serverless Functions | Vercel | Otomatis tersedia pada platform Vercel, tidak perlu setup khusus |
| Hosting | Vercel | Otomatis via project import; produksi live di `app.machapp.web.id` |

> **Web signup & email confirmation** — pendaftaran via `app/login` sengaja dibuat
> **langsung aktif**: route server `POST /api/signup` membuat akun lewat service role dengan
> `email_confirm: true`. Pelaksana golongan 1-5 yang internet/email-nya diblokir IT **tidak perlu
> klik link konfirmasi email** untuk bisa login. Karena plain `@supabase/supabase-js` browser
> `signUp` sudah tidak dipakai, pastikan di **Supabase Dashboard**:
> - **Authentication → Sign In / Providers → Email → Confirm email** di-*OFF* (agar tidak ada email
>   konfirmasi terkirim yang link-nya mengarah ke alamat lokal).
> - **Authentication → URL Configuration → Site URL** di-set ke `https://app.machapp.web.id`
>   (dan tambahkan di **Redirect URLs**), supaya link otentikasi apa pun mengarah ke produksi,
>   bukan `localhost:3000`.

> Catatan biaya:
> - **Supabase Free** menyediakan 500 MB database, 50.000 monthly active users untuk Auth, 1 GB storage, dan 2 GB egress. Cukup untuk skala tim satu departemen.
> - **Vercel Hobby** menyediakan 100 GB bandwidth, 500 serverless function invocations per hari (atau lebih sesuai kebijakan terbaru), domain gratis.
> - Untuk production, pantau pemakaian. Vercel menyediakan **Usage Alerts**, Supabase dapat di-set **Spending Cap** (billing) agar tidak melebihi batas biaya.

### 1.3 Install tooling lokal

```bash
npm install -g supabase
npm install -g vercel

Pastikan Docker terinstall untuk menjalankan Supabase local development.

Login dan inisialisasi project lokal:

# Login Supabase
supabase login

# Link project lokal ke Supabase cloud
supabase link --project-ref <PROJECT_REF>

# Login Vercel
vercel login
vercel link
Untuk frontend, gunakan framework sesuai kebutuhan (Next.js / React / Vite). Jalankan dev server dengan Vercel:

vercel dev
1.4 Struktur database yang perlu disiapkan
Buat tabel-tabel berikut di Supabase (bisa via dashboard SQL Editor atau migration). Struktur field detail ada di PROJECT_BRIEF.md bagian architecture.

> Migrasi `0009_teams.sql`, `0010_external_requests.sql`, dan `0011_external_pickup.sql`
> menambah tabel `teams`, `team_members`, `external_requests`, `telegram_external_convos`,
> kolom pick up (`picked_by`, `task_id`, `rejected_by`), serta function
> `get_subordinate_ids` (bawahan rekursif). Terapkan dengan `supabase db push` atau
> tempel ke SQL Editor, urut setelah `0008`.
>
> **Migrasi `0014_approve_report_hierarchy.sql` WAJIB diterapkan** — RPC `approve_report`
> sebelumnya hanya menerima penyetuju yang persis sama dengan `tasks.assigned_by`, sehingga
> task hasil pick-up laporan (yang `assigned_by`-nya NULL) tidak bisa disetujui siapa pun
> (tombol Setujui gagal 403 dari database). Versi baru menerima pembuat task ATAU atasan
> rekursif si pelaksana. Tanpa migrasi ini, antrian approval akan tampil di dashboard tapi
> approve-nya tetap ditolak.

-- users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  npk TEXT UNIQUE NOT NULL,
  email TEXT,
  golongan INTEGER NOT NULL,
  title TEXT,
  atasan_id UUID REFERENCES users(id),
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- pending_registrations
CREATE TABLE pending_registrations (
  chat_id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  npk TEXT NOT NULL,
  golongan INTEGER NOT NULL,
  title TEXT,
  email TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'assigned', -- assigned | in_progress | report_submitted | approved | rejected
  points INTEGER NOT NULL DEFAULT 0,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- task_reports (completion report)
CREATE TABLE task_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  progress_note TEXT NOT NULL,
  photo_url TEXT,
  status TEXT DEFAULT 'report_submitted',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- task_problems (problem report)
CREATE TABLE task_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  urgency TEXT NOT NULL, -- bisa_nunggu | perlu_hari_ini | mendesak
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- points_history
CREATE TABLE points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  task_id UUID REFERENCES tasks(id),
  points INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
Catatan: Supabase otomatis mengaktifkan Realtime untuk tabel yang memiliki replication. Jalankan perintah berikut jika ingin menggunakan fitur realtime pada tabel tertentu:

ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE task_reports REPLICA IDENTITY FULL;
ALTER TABLE task_problems REPLICA IDENTITY FULL;
(dan tabel lain yang perlu di-subscribe dari frontend)

1.5 Row Level Security (RLS) — wajib aktif
Supabase menggunakan Row Level Security untuk membatasi akses data dari client. Berikut draft awal kebijakan yang dapat disesuaikan.

-- Aktifkan RLS pada tabel
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

-- Helper function untuk cek golongan user yang sedang login
CREATE OR REPLACE FUNCTION public.get_user_golongan()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT golongan FROM users WHERE id = auth.uid()
$$;

-- users
CREATE POLICY "users read authenticated" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "users write golongan >= 5" ON users
  FOR ALL TO authenticated
  USING (get_user_golongan() >= 5)
  WITH CHECK (get_user_golongan() >= 5);

-- pending_registrations (hanya admin/atasan yang bisa mengelola)
CREATE POLICY "pending_reg read authenticated" ON pending_registrations
  FOR SELECT TO authenticated USING (get_user_golongan() >= 5);

CREATE POLICY "pending_reg write golongan >= 5" ON pending_registrations
  FOR ALL TO authenticated
  USING (get_user_golongan() >= 5)
  WITH CHECK (get_user_golongan() >= 5);

-- tasks
CREATE POLICY "tasks read authenticated" ON tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tasks create update golongan >= 5" ON tasks
  FOR INSERT TO authenticated WITH CHECK (get_user_golongan() >= 5);

CREATE POLICY "tasks update golongan >= 5" ON tasks
  FOR UPDATE TO authenticated USING (get_user_golongan() >= 5);

-- task_reports
CREATE POLICY "reports read authenticated" ON task_reports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reports insert authenticated" ON task_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports update golongan >= 5" ON task_reports
  FOR UPDATE TO authenticated USING (get_user_golongan() >= 5);

-- task_problems
CREATE POLICY "problems read create authenticated" ON task_problems
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "problems insert authenticated" ON task_problems
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- points_history
CREATE POLICY "points read authenticated" ON points_history
  FOR SELECT TO authenticated USING (true);

-- Tidak ada policy untuk INSERT/UPDATE/DELETE pada points_history untuk client
-- Hanya boleh ditulis lewat server (Vercel Function) dengan service role key
Poin penting: penulisan pada points_history tidak boleh langsung dari client, harus lewat Vercel Serverless Function yang menggunakan SUPABASE_SERVICE_ROLE_KEY (bypass RLS), supaya poin tidak bisa dimanipulasi dari sisi frontend.

1.6 Environment variables untuk Vercel
Set environment variables di Vercel Project Settings → Environment Variables. Tambahkan:

Variable	Nilai	Digunakan oleh
NEXT_PUBLIC_SUPABASE_URL	URL project Supabase (https://xxxx.supabase.co)	Server & frontend
NEXT_PUBLIC_SUPABASE_ANON_KEY	Anon/public key dari Supabase	Frontend (aman untuk diekspos)
SUPABASE_SERVICE_ROLE_KEY	Service role key dari Supabase (RAHASIA)	Hanya server functions
TELEGRAM_BOT_TOKEN	Token bot Telegram	Server functions (webhook, notifikasi)
TELEGRAM_ADMIN_CHAT_ID	Chat ID admin Telegram	Server functions (approval)
EMAIL_API_KEY	API key layanan email (Resend/SendGrid)	Server functions (email notifikasi)
Untuk development lokal, buat file .env.local (jangan di-commit) dan isi variabel yang sama. Vercel CLI akan otomatis membacanya.

2. Persiapan Telegram bot
2.1 Buat bot lewat BotFather
Buka Telegram, cari @BotFather
Kirim /newbot, ikuti instruksi (nama bot, username harus diakhiri bot, misal EngineeringTaskBot)
BotFather akan kasih bot token — simpan ini, jangan di-commit ke git
2.2 Tentukan admin approval
Tentukan siapa yang jadi admin penyetuju registrasi (bisa SM atau HR/IT lokal)
Admin kirim /start ke bot @userinfobot untuk dapat chat_id miliknya sendiri
Simpan chat_id admin ini sebagai environment variable TELEGRAM_ADMIN_CHAT_ID
2.3 Set webhook
Setelah Vercel Function untuk handle update Telegram sudah di-deploy, daftarkan webhook:

# Produksi live (domain app.machapp.web.id):
curl -F "url=https://app.machapp.web.id/api/telegramWebhook" \
  -F "secret_token=ISI_TELEGRAM_WEBHOOK_SECRET" \
  https://api.telegram.org/botISI_TOKEN_BOT/setWebhook
# Lokal/staging: ganti url=https://<NAMA-PROJECT>.vercel.app/api/telegramWebhook (atau URL ngrok)
Verifikasi webhook aktif:

curl https://api.telegram.org/botISI_TOKEN_BOT/getWebhookInfo
Catatan: Route `/api/telegramWebhook` ada di `app/api/telegramWebhook/route.js` (Next.js App Router). Nilai `secret_token` di atas harus sama dengan `TELEGRAM_WEBHOOK_SECRET` pada environment variable — route akan menolak update tanpa token yang cocok.

2.4 Command dan interaksi yang perlu diimplementasi
Command/aksi	Fungsi
/start	Cek apakah chat_id sudah terdaftar di tabel users. Jika belum, minta NPK dulu → cocokkan ke users (penautan akun web) atau lanjut registrasi (nama, golongan, title, email)
Inline button Setujui/Tolak (dikirim ke admin)	Callback query yang memindahkan data dari tabel pending_registrations ke users
Notifikasi task baru	Pesan terkirim otomatis saat Vercel Function onTaskCreated dipanggil (atau trigger database)
Balasan completion report	Bot terima teks/foto balasan, simpan ke tabel task_reports
Balasan problem report	Bot terima teks urgensi + deskripsi, simpan ke tabel task_problems, langsung notif ke atasan terkait
2.5 Testing bot secara lokal
Gunakan Vercel Dev dan Supabase Local untuk pengembangan:

# Jalankan database lokal Supabase
supabase start

# Jalankan fungsi Vercel dan frontend lokal
vercel dev
vercel dev akan mengekspos fungsi serverless di http://localhost:3000/api/*. Untuk expose local endpoint ke internet saat testing webhook Telegram, pakai ngrok:

ngrok http 3000
Lalu set webhook sementara ke URL ngrok, misal https://random.ngrok.io/api/telegramWebhook.

3. Persiapan email notifikasi
3.1 Pilih layanan
Rekomendasi: Resend (gratis sampai 3000 email/bulan, setup sederhana) atau SendGrid. Hindari coba kirim langsung lewat SMTP Gmail pribadi karena rawan kena limit/spam flag.

3.2 Setup
Daftar akun di layanan pilihan, verifikasi domain pengirim (misal `notif.machapp.web.id`)
Dapatkan API key, simpan sebagai environment variable di Vercel (`EMAIL_API_KEY`)
Set `EMAIL_FROM`, contoh: `Macha App <notif.machapp.web.id>`
Buat template email sederhana: notifikasi task baru, hasil approval, registrasi disetujui
3.3 Yang perlu dikonfirmasi ke tim
Daftar alamat email kantor untuk tiap SM/ASM/SPV yang akan menerima notifikasi
Konfirmasi bahwa email dari domain layanan pihak ketiga (misal @resend.dev atau domain sendiri yang terverifikasi) tidak otomatis masuk folder spam di sistem email kantor — kalau perlu, minta IT lokal whitelist domain pengirim ini di filter spam (ini permintaan ringan, beda dengan permintaan akses IMAP/SMTP penuh)
4. Urutan implementasi yang disarankan
Setup Supabase project + schema + RLS — fondasi semua fitur lain
Auth + dashboard read-only — pastikan user bisa login (Supabase Auth) dan lihat data dummy dulu
Telegram bot: registrasi + approval admin — validasi alur paling kritikal duluan
Task assignment + notifikasi Telegram — inti dari aplikasi
Completion report + approval + poin otomatis — tutup loop utama
Problem report — jalur tambahan, lebih sederhana dari completion report
Email notifikasi — tambahan, tidak blocking fitur inti
Statistik & dashboard kinerja — setelah data poin mulai terkumpul dari testing
5. Checklist sebelum go-live
 Row Level Security (RLS) sudah direview, tidak ada tabel yang bisa ditulis bebas dari client
 Environment variables Vercel (bot token, API key, service role key) tidak ter-commit ke repository
 Spending cap / usage alert Vercel dan Supabase sudah diset
 Minimal 1 admin telegram sudah dikonfirmasi dan tested untuk approval registrasi
 Domain email pengirim sudah tidak masuk folder spam kantor (tes kirim ke beberapa email kantor dulu)
 Backup Supabase sudah disiapkan (Supabase menyediakan daily backup otomatis, pastikan untuk production juga siapkan pg_dump manual atau scheduled backup)