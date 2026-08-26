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
| `/start` | Mulai / daftarkan diri ke bot (chat pribadi) | Semua karyawan |
| `/daftargrup` | Daftarkan group/channel agar semua notif masuk ke sana | Admin (di dalam group/channel) |
| `/hapusgrup` | Hapus group/channel dari daftar penerima notif | Admin (di dalam group/channel) |

> Selain perintah di atas, user tidak perlu mengetik perintah lain — laporan
> dikirim dengan cara **membalas (reply)** pesan notifikasi task dari bot (lihat bawah).

### Alur 1 — Registrasi user ke bot

1. Karyawan membuka bot di chat pribadi: `t.me/<username_bot>` → tekan **Start**
   (atau kirim `/start`).
2. Bot bertanya **nama lengkap** → jawab dengan nama.
3. Bot bertanya **NPK** → jawab dengan NPK karyawan.
4. Bot bertanya **golongan** (angka 1–7) → jawab angka.
5. Bot bertanya **title/jabatan** → jawab angka: 1. Intern, 2. Operator, 3. Technician, 4. SPV, 5. Assistant Manager, 6. Section Manager.
6. Bot menyimpan data ke `pending_registrations` dan mengirim notifikasi ke
   **admin approval** (chat `TELEGRAM_ADMIN_CHAT_ID`) dengan tombol inline:
   - ✅ **Setujui** → user dipindah ke tabel `users`, `chat_id`-nya terhubung ke akun.
   - ❌ **Tolak** → pendaftaran dihapus, user mendapat pesan penolakan.
6. Setelah disetujui, user mendapat pesan "kamu sudah aktif sebagai <golongan>".
   Jika user kirim `/start` lagi sebelum di-approve, bot membalas "masih menunggu approval".

> Catatan: user yang terdaftar lewat bot (Telegram) belum punya akun login web
> (email/password). Akun web dibuat terpisah untuk login dashboard. Untuk tahap
> UAT, akun dummy web sudah disediakan; akun Telegram adalah jalur laporan cepat.

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

### Rangkuman notifikasi

| Kejadian | Dikirim ke |
| --- | --- |
| Task baru dibuat | Pelaksana (chat pribadi) + group/channel terdaftar |
| Completion report masuk | Atasan + group/channel terdaftar |
| Problem report masuk | Atasan (prioritas tinggi) + group/channel terdaftar |
| Task disetujui | Pelaksana + group/channel terdaftar |
| Task perlu revisi | Pelaksana + group/channel terdaftar |

> Selain Telegram, notifikasi penting juga dikirim ke **email** penerima
> (via Resend). Email aktif bila `EMAIL_API_KEY` + `EMAIL_FROM` terisi.

