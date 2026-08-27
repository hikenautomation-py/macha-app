# API specification

Semua endpoint di-host sebagai Vercel Serverless Functions (API routes). Autentikasi web dashboard menggunakan Supabase Auth JWT; interaksi Telegram divalidasi lewat webhook signature Telegram sendiri, bukan token ini.

## Konvensi umum

**Base URL**: `https://<NAMA-PROJECT>.vercel.app/api` — produksi live: `https://app.machapp.web.id/api`

**Autentikasi**: kirim header `Authorization: Bearer <supabase_jwt>` untuk semua endpoint dashboard. Vercel Function memvalidasi token menggunakan Supabase Auth (JWT verification), lalu mengambil profil user (golongan + title) dari tabel `users` di PostgreSQL untuk otorisasi per endpoint (atasan = golongan ≥ 5 dengan title SPV ke atas).

**Format response sukses**:
```json
{ "success": true, "data": { } }

Format response gagal:

{ "success": false, "error": { "code": "PERMISSION_DENIED", "message": "Golongan kamu tidak bisa membuat task" } }
Kode error yang dipakai konsisten: UNAUTHENTICATED, PERMISSION_DENIED, NOT_FOUND, INVALID_ARGUMENT, ALREADY_EXISTS, INTERNAL.

1. Auth & registrasi
POST /registerRequest
Dipanggil dari sisi Telegram bot (internal, dipanggil dari handler webhook, bukan dari client). Membuat entri pending registration.

> **Alur web ↔ Telegram:** saat registrasi di bot, user diminta **NPK** lebih dulu.
> NPK dicocokkan dengan tabel `users` — kalau sudah ada (akun web), `telegram_chat_id`
> langsung di-set ke akun tersebut (penautan, tanpa isi data ulang). Kalau belum ada,
> registrasi dilanjutkan (nama → golongan → title → email) lalu baris `pending_registrations` dibuat.

Request:

{ "chatId": "123456789", "nama": "Budi Santoso", "npk": "00123456", "golonganKlaim": 3, "title": "Technician", "email": "budi@perusahaan.com" }
Response: { "success": true, "data": { "status": "pending" } }

POST /registerApprove
Dipanggil saat admin tap tombol inline Setujui di Telegram (internal, dari callback query handler). Memindahkan data dari tabel pending_registrations ke tabel users. Kolom `email` (jika diisi) ikut disalin ke `users.email`, lalu notifikasi email "akun aktif" dikirim ke alamat tersebut.

Request:

{ "chatId": "123456789", "approvedBy": "admin_chat_id", "golonganFinal": 3, "atasanId": "user_spv_id" }
Response: { "success": true, "data": { "userId": "generated_id" } }

POST /registerReject
Sama seperti di atas tapi menghapus entri pending dan mengirim pesan penolakan.

2. Task
POST /tasks
Buat task baru. Hanya atasan (golongan ≥ 5 DAN title SPV ke atas).

Request:

{
  "judul": "Perbaikan mesin CNC-04",
  "deskripsi": "Cek kalibrasi axis Z, ganti spindle bearing",
  "ditugaskanKe": "user_id_technician",
  "bobotPoin": 10,
  "deadline": "2026-08-30"
}
Response: { "success": true, "data": { "taskId": "abc123", "status": "assigned" } }

Efek samping: trigger notifikasi Telegram + (opsional) email ke user yang ditugaskan.

GET /tasks?userId={id}&status={status}
Ambil daftar task milik user tertentu, bisa difilter status. Dipakai dashboard technician untuk "task hari ini".

Response:

{
  "success": true,
  "data": [
    { "taskId": "abc123", "judul": "Perbaikan mesin CNC-04", "status": "in_progress", "bobotPoin": 10, "deadline": "2026-08-30" }
  ]
}
GET /tasks/pendingApproval?atasanId={id}
Daftar task dengan status = report_submitted di bawah atasan tertentu. Dipakai dashboard atasan.

PATCH /tasks/{taskId}/status
Ubah status task. Endpoint umum dipanggil internal oleh endpoint lain (jarang dipanggil langsung dari client).

3. Completion report
POST /tasks/{taskId}/reports
Submit laporan penyelesaian. Bisa dipanggil dari web dashboard atau dari bot handler Telegram.

Request:

{ "catatan": "Sudah diganti bearing, sudah dites jalan normal", "lampiranUrl": "https://<PROJECT_REF>.supabase.co/storage/v1/object/public/task-attachments/foto.jpg" }
Response: { "success": true, "data": { "reportId": "r001", "statusTask": "report_submitted" } }

Validasi: catatan wajib diisi, lampiranUrl opsional.

POST /tasks/{taskId}/reports/{reportId}/approve
Hanya bisa dipanggil oleh atasan_id dari task terkait (atasan = golongan ≥ 5 DAN title SPV ke atas).

Efek samping (dalam satu transaksi database, menggunakan PostgreSQL transaction atau RPC function):

Update tasks.status → approved
Insert baris baru ke tabel points_history sebesar bobotPoin task
Kirim notifikasi ke user pelaksana
Response: { "success": true, "data": { "poinDitambahkan": 10 } }

POST /tasks/{taskId}/reports/{reportId}/reject
Request:

{ "catatanRevisi": "Foto belum jelas, tolong ambil ulang dari sisi kanan mesin" }
Efek samping: tasks.status kembali ke in_progress, notifikasi ke pelaksana berisi catatan revisi.

4. Problem report
POST /tasks/{taskId}/problems
Request:

{ "urgensi": "mendesak", "deskripsiMasalah": "Line 2 downtime, sensor proximity error" }
Response: { "success": true, "data": { "problemId": "p001" } }

Efek samping: notifikasi langsung ke atasan_id, prioritas tinggi (tidak masuk antrian approval biasa seperti completion report).

POST /tasks/{taskId}/problems/{problemId}/resolve
Request:

{ "keputusan": "Task dijeda, tunggu part pengganti dari gudang" }
Response: { "success": true }

5. Statistik & poin
GET /users/{userId}/points?month={yyyy-mm}
Total poin user pada bulan tertentu, dipakai kartu "poin bulan ini".

Response:

{ "success": true, "data": { "totalPoin": 85, "jumlahTaskSelesai": 9 } }
GET /teams/{atasanId}/stats?month={yyyy-mm}
Statistik seluruh bawahan seorang atasan, dipakai tabel statistik kinerja tim.

Response:

{
  "success": true,
  "data": [
    { "userId": "u1", "nama": "Budi Santoso", "golongan": 3, "title": "Technician", "poin": 85 },
    { "userId": "u2", "nama": "Sari Dewi", "golongan": 1, "title": "Operator", "poin": 62 }
  ]
}
5a. Teams & organisasi
GET /teams
Daftar team yang dikelola (lead_id / created_by = diri sendiri), disertai member.

POST /teams
Buat team. Body: { "nama": "Line 1", "leadId": "user_id" } — leadId opsional, default diri sendiri, dan harus diri sendiri atau bawahan.

POST /teams/{id}/members
Tambah/hapus anggota. Body: { "userId": "...", "action": "add" | "remove" }. Hanya lead/creator team; target harus subtree bawahan manager. Add akan menyinkronkan users.atasan_id = lead team.

5b. Laporan umum & problem list
POST /external
Publik (tanpa login). Body: { "type": "problem"|"improvement", "nama": "...", "npk": "...", "deskripsi": "..." }. Simpan ke external_requests, notif Telegram + email atasan.

GET /external?type=&status=
Semua user login. Daftar laporan umum / request (tidak terbatas atasan).

POST /external/{id}/resolve
Atasan. Body: { "keputusan": "..." } → status resolved.

GET /problems?status=open
Atasan. Problem report pada task yang assigned_by = dirinya, disertai judul task + nama pelapor.

GET /dashboard/summary
Atasan. Payload metric: { taskAktif, menungguApproval, problemOpen, anggotaTim, totalPoinTim, externalOpen }.

6. Webhook Telegram (internal, bukan API publik untuk dashboard)
POST /telegramWebhook
Endpoint tunggal yang menerima semua update dari Telegram (pesan, callback query tombol inline). Divalidasi lewat secret token webhook Telegram, bukan Supabase JWT.

Routing internal berdasarkan isi update:

message.text = "/start" → alur registrasi / penautan (NPK dulu → cocokkan ke `users`; kalau sudah ada langsung tertaut, kalau belum → nama → golongan → title → email)
callback_query.data diawali approve_ / reject_ → alur approval admin
message.reply_to_message merujuk ke task tertentu → completion/problem report tergantung konteks percakapan yang tersimpan sementara (state machine percakapan per chat_id)
Ringkasan endpoint
Endpoint	Method	Golongan minimum
/registerRequest	POST	- (internal bot)
/registerApprove	POST	admin only
/signup	POST	- (publik, service role)
/tasks	POST	5 (SPV; hanya ke bawahan)
/tasks	GET	semua (scope: diri sendiri, atasan: subtree)
/tasks/pendingApproval	GET	5 (hanya task assigned_by dirinya)
/tasks/{id}/status	PATCH	5, harus atasan terkait
/tasks/{id}/reports	POST	semua (hanya task miliknya)
/tasks/{id}/reports/{id}/approve	POST	5, harus atasan terkait
/tasks/{id}/problems	POST	semua (hanya task miliknya)
/tasks/{id}/problems/{id}/resolve	POST	5
/problems	GET	5 (problem pada task assigned_by dirinya)
/teams	GET/POST	5
/teams/{id}/members	POST	5 (lead/creator team)
/teams/{id}/stats	GET	5 (hanya id == diri sendiri)
/external	POST	- (publik); GET semua user login
/external/{id}/resolve	POST	5
/dashboard/summary	GET	5
/users/{id}/points	GET	semua (hanya data sendiri, kecuali atasan)
/telegramWebhook	POST	- (validasi via Telegram secret)