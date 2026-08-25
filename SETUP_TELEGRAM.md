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
