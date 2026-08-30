# Setup Telegram Bot — Mendapatkan TELEGRAM_BOT_TOKEN

Panduan langkah demi langkah untuk membuat bot Telegram dan mengambil token bot,
yang nanti diisi ke variabel `TELEGRAM_BOT_TOKEN` di `.env.local`.

## Prasyarat
- Punya akun Telegram (aplikasi HP / desktop, atau web.telegram.org).
- Sudah login ke akun tersebut.

## Langkah 1 — Buka @BotFather
1. Buka Telegram.
2. Ketik `BotFather` di kolom pencarian (atau buka https://t.me/BotFather).
3. Pastikan akun yang dipilih punya centang biru ✅ dan nama resmi "BotFather".
4. Tekan tombol **Start** (atau kirim pesan `/start`).
5. BotFather akan membalas dengan daftar perintah yang tersedia.

## Langkah 2 — Buat bot baru
1. Kirim perintah:
   ```
   /newbot
   ```
2. BotFather bertanya: "Alright, a new bot. How are we going to call it?"
3. Ketik **nama tampilan** bot (boleh pakai spasi), contoh:
   ```
   Task Tracker Engineering
   ```

## Langkah 3 — Tentukan username bot
1. BotFather bertanya: "Good. Now let's choose a username for your bot."
2. Ketik **username** yang harus:
   - diakhiri kata `bot`,
   - hanya huruf kecil, angka, dan underscore,
   - unik (belum dipakai bot lain).
3. Contoh:
   ```
   task_tracker_eng_bot
   ```
   > Kalau username sudah dipakai, BotFather akan menolak. Coba variasi lain,
   > misal `task_tracker_eng_2026_bot` atau `macha_tt_bot`.

## Langkah 4 — Salin token bot
1. Kalau berhasil, BotFather membalas dengan pesan sukses yang berisi:
   ```
   Done! Congratulations on your new bot...

   Use this token to access the HTTP API:
   123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
   ```
2. Baris setelah "Use this token to access the HTTP API:" itulah **TELEGRAM_BOT_TOKEN**.
3. Salin token tersebut (simpan di tempat aman, JANGAN dibagikan / di-commit).

## Langkah 5 — Isi token ke `.env.local`
Buka file `.env.local` di root project, lalu ganti placeholder:
```
TELEGRAM_BOT_TOKEN=123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
```

## Langkah 6 — Verifikasi bot (opsional)
1. Di BotFather, kirim `/mybots`, pilih bot kamu, cek statusnya aktif.
2. Buka link bot kamu (dari pesan sukses: `t.me/<username_bot>`), tekan Start,
   lalu coba kirim `/help` atau `/start`.

## Token bocor / salah?
- Kirim `/revoke` di BotFather untuk mengganti token lama dengan yang baru
  (token lama langsung tidak berlaku).
- Selalu pakai token baru di `.env.local`.

---

## Lanjutan (dibutuhkan project ini)

### Mendapatkan TELEGRAM_ADMIN_CHAT_ID
1. Buka bot `@userinfobot` (atau `@getidsbot`), tekan Start.
2. Forward/teruskan satu pesan dari admin approval ke bot itu, atau minta admin
   langsung kirim `/start` ke bot kamu.
3. Catat angka `id` yang dikembalikan → isi ke `TELEGRAM_ADMIN_CHAT_ID`.

### Menyiapkan TELEGRAM_WEBHOOK_SECRET
1. Buat string acak yang panjang (misal 32+ karakter). Contoh cara buat:
   ```
   openssl rand -hex 32
   ```
2. Isi ke `TELEGRAM_WEBHOOK_SECRET` di `.env.local`.
3. Pakai nilai yang sama saat daftar webhook (`setWebhook` dengan `secret_token`).

---

## Panduan penggunaan (alur lengkap)

Berikut alur pemakaian bot **setelah** bot dibuat, token terpasang, dan webhook aktif.

### Daftar perintah bot

| Perintah | Fungsi | Siapa |
| --- | --- | --- |
| `/start` | Mulai / daftarkan diri ke bot — ketik NPK untuk menautkan akun web, atau lanjut registrasi (chat pribadi) | Semua karyawan |
| `/laporan` | Laporkan masalah umum (tanpa akun, cukup nama + NPK) | Siapa pun (termasuk non-karyawan) |
| `/request` | Ajukan permintaan improvement (tanpa akun, cukup nama + NPK) | Siapa pun (termasuk non-karyawan) |
| `/help` | Tampilkan daftar perintah & cara lapor task | Semua karyawan |
| `/daftargrup` | Daftarkan group/channel agar semua notif masuk ke sana | Admin (di dalam group/channel) |
| `/hapusgrup` | Hapus group/channel dari daftar penerima notif | Admin (di dalam group/channel) |

> Saat user mengetik `/` di chat, menu perintah bot otomatis muncul
> (`/start`, `/laporan`, `/request`, `/help`) berkat `setMyCommands`.
> Menu disegarkan otomatis setiap ada perintah setelah deploy.

> **Notifikasi task baru** di chat pribadi pelaksana kini punya 3 tombol aksi:
> - `🚨 Lapor` → lapor masalah task (bisa awali dengan urgensi: mendesak / perlu hari ini / bisa nunggu)
> - `📝 Update` → catat progress, task di-set menjadi *sedang dikerjakan*
> - `✅ Selesai` → kirim laporan penyelesaian (status jadi *menunggu approval*)
>
> Setelah tombol ditekan, bot menanyakan keterangan lanjutan — balas di chat bersangkutan.
> Broadcast ke group/channel tidak memuat tombol. Butuh migrasi `0008` + deploy.

> Selain perintah di atas, user tidak perlu mengetik perintah lain — laporan
> dikirim dengan cara **membalas (reply)** pesan notifikasi task dari bot (lihat bawah).

### Alur 1 — Registrasi user ke bot (+ penautan akun web)

1. Karyawan membuka bot di chat pribadi: `t.me/<username_bot>` → tekan **Start**
   (atau kirim `/start`).
2. Bot bertanya **NPK** terlebih dahulu → jawab dengan NPK karyawan.
3. Bot mencocokkan NPK dengan akun web (tabel `users`):
   - **NPK sudah terdaftar di web** → akun Telegram langsung **tertaut** ke akun
     web tersebut (`telegram_chat_id` diisi). Notifikasi task akan masuk ke chat
     ini. Selesai — tidak perlu isi data ulang.
   - **NPK belum terdaftar** → lanjut registrasi lewat bot:
     a. Bot bertanya **nama lengkap** → jawab dengan nama.
     b. Bot bertanya **golongan** (angka 1–7) → jawab angka.
     c. Bot bertanya **title/jabatan** → jawab angka: 1. Intern, 2. Operator, 3. Technician, 4. SPV, 5. Assistant Manager, 6. Section Manager.
     d. Bot bertanya **email** → jawab email. ⚠️ Bot mengingatkan bahwa email ini
        juga dipakai untuk **notifikasi** (task baru, hasil approval, dll) dan
        **disarankan memakai email kantor**.
4. Bot menyimpan data ke `pending_registrations` (status `pending`) dan mengirim
   notifikasi ke **admin approval** (chat `TELEGRAM_ADMIN_CHAT_ID`) dengan tombol inline:
   - ✅ **Setujui** → user dipindah ke tabel `users`, `chat_id`-nya terhubung ke akun
     (+ email ikut tersimpan; email "akun aktif" dikirim ke alamat tsb).
   - ❌ **Tolak** → pendaftaran dihapus, user mendapat pesan penolakan.
5. Setelah data lengkap, bot membalas **"registrasi menunggu approval admin"** dan
   menyarankan untuk **login / pantau status di web app: https://app.machapp.web.id**.
6. Setelah disetujui, user mendapat pesan "kamu sudah aktif". Jika user kirim
   `/start` lagi sebelum di-approve, bot membalas "masih menunggu approval".

> Catatan: **NPK adalah kunci unik** yang menghubungkan akun web dan Telegram.
> Kalau sudah punya akun web, cukup ketik NPK di bot — chat Telegram langsung
> tertaut tanpa registrasi ulang. User yang terdaftar lewat bot dan belum punya
> akun web tetap bisa membuka web app setelah di-approve (data login web dibuat
> terpisah oleh admin bila diperlukan).

### Alur 2 — Mendaftarkan group/channel (notif broadcast)

Supaya **semua notifikasi task** (task baru, laporan selesai, laporan masalah,
hasil approval) masuk ke satu group/channel, daftarkan group/channel tersebut:

1. Tambahkan bot ke group/channel kamu.
   - **Group**: buka info grup → Add member → cari `@<username_bot>`.
   - **Channel**: buka info channel → Administrators → Add admin → cari bot.
2. Pastikan bot bisa membaca/mengirim pesan:
   - Di **@BotFather**: `/mybots` → pilih bot → **Bot Settings → Group Privacy → Turn off**,
     ATAU jadikan bot sebagai **admin** grup.
   - Untuk **channel**, bot **wajib** dijadikan admin agar bisa kirim pesan.
3. **Admin** kirim perintah di dalam group/channel tersebut:
   ```
   /daftargrup
   ```
4. Bot membalas konfirmasi + menampilkan `chat_id` group/channel.
5. Selesai — semua notifikasi task otomatis diteruskan ke group/channel itu
   (selain ke chat pribadi masing-masing penerima).

> Hapus dari daftar kapan saja dengan mengirim `/hapusgrup` di group/channel tsb.
> Hanya admin (golongan ≥ 5 atau pemilik `TELEGRAM_ADMIN_CHAT_ID`) yang bisa
> mendaftar/menghapus group/channel.

### Alur 3 — Lapor task selesai (completion report)

Ada dua cara:

**A. Lewat bot (cepat):**
1. Saat ada task baru, bot mengirim pesan ke pelaksana berisi tag
   `#task_<id>` (contoh `#task_123e4567-...`).
2. Pelaksana **membalas (reply)** pesan notifikasi itu, sambil **melampirkan foto**
   sebagai bukti pengerjaan.
3. Bot otomatis membuat completion report (status task → `report_submitted`),
   lalu mengirim notifikasi "menunggu approval" ke atasan.
4. Atasan menyetujui/menolak dari dashboard web.

**B. Lewat web dashboard:**
- Buka dashboard → task → **Lapor selesai** → isi catatan + unggah foto → submit.

> Foto dari bot saat ini dicatat sebagai laporan (kolom `photo_url` diisi `null`
> karena belum ada upload storage dari sisi bot) — upload foto penuh tersedia
> lewat dashboard web.

### Alur 4 — Lapor masalah (problem report)

**A. Lewat bot (cepat):**
1. Pelaksana **membalas (reply)** pesan notifikasi task (`#task_<id>`) dengan
   **teks saja** (tanpa foto).
2. Opsional: tulis tingkat urgensi di kata pertama:
   - `mendesak` → "Mendesak"
   - `perlu hari ini` → "Perlu hari ini"
   - `bisa nunggu` → "Bisa nunggu"
   - Kalau tidak ditulis, default = "perlu hari ini".
   Contoh balasan: `mendesak Line 2 downtime, sensor proximity error`
3. Bot membuat problem report dengan prioritas tinggi dan mengirim notifikasi
   langsung ke atasan (tidak masuk antrian approval biasa).

**B. Lewat web dashboard:**
- Buka dashboard → task → **Lapor masalah** → pilih urgensi + deskripsi → submit.

### Alur 5 — Laporan masalah umum & permintaan improvement (tanpa akun)

Untuk seksi lain (mis. produksi) yang tidak punya akun web, tersedia dua perintah:

1. Kirim `/laporan` (masalah umum) atau `/request` (improvement).
2. Bot bertanya **nama lengkap** → jawab nama.
3. Bot bertanya **NPK** → jawab NPK (ketik `-` kalau tidak ada).
4. Bot bertanya **deskripsi** → jawab masalah/usulan.
5. Laporan masuk ke `external_requests` dengan notif ke admin/channel berisi
   tombol inline:
   - `🙋 Pick up` → siapa pun yang chat_id-nya sudah tertaut ke akun bisa ambil.
     Bot membuat task baru untuk si picker (assigned_by = atasan si picker).
   - `❌ Reject` → hanya SPV ke atas; menutup laporan/request.
6. Email juga dikirim ke atasan.

Alternatif: buka form web publik di `app.machapp.web.id/laporan` dan
`app.machapp.web.id/request`. Siapa pun yang login web bisa melihat daftar
laporan/request tanpa menunggu delegasi atasan.

**Penanganan laporan dari web** (bukan hanya lewat Telegram):
- **Teknisi/operator** login ke `/tech` → lihat section "Laporan umum &
  request" di sidebar → klik **"🙋 Pick up"** pada laporan terbuka.
  Laporan otomatis dibuatkan task untuk dirinya sendiri
  (`POST /api/external/{id}/pickup`, helper `createTaskFromExternal`).
- **Atasan** login ke `/dashboard` → lihat section "Laporan umum & request" →
  klik **"Resolve"** untuk menutup tanpa task, atau **"Assign to"** untuk
  munculkan modal pilih bawahan → task baru tercipta untuk bawahan
  (`POST /api/external/{id}/assign`).
- Kedua aksi web menggunakan guard `.eq('status','open')` yang sama dengan
  pickup Telegram, sehingga **aman dari double-pick** (user yang kalah dapat
  pesan `ALREADY_PICKED`).

### Rangkuman notifikasi

| Kejadian | Dikirim ke |
| --- | --- |
| Task baru dibuat | Pelaksana (chat pribadi) + group/channel terdaftar |
| Completion report masuk | Atasan + group/channel terdaftar |
| Problem report masuk | Atasan (prioritas tinggi) + group/channel terdaftar |
| Task disetujui | Pelaksana + group/channel terdaftar |
| Task perlu revisi | Pelaksana + group/channel terdaftar |
| Laporan/request masuk | Admin + group/channel terdaftar (tombol Pick up / Reject) |
| Laporan/request di-pick up (Telegram) | Task baru ke si picker |
| Laporan/request di-pick up (web `/tech`) | Task baru ke picker + email |
| Laporan/request di-assign (web `/dashboard`) | Task baru ke bawahan + email |
| Akun di-approve | Email user (jika email diisi saat registrasi) |

> Selain Telegram, notifikasi penting juga dikirim ke **email** penerima
> (via Resend). Email aktif bila `EMAIL_API_KEY` + `EMAIL_FROM` terisi
> (contoh `EMAIL_FROM=Macha App <notif.machapp.web.id>`).

