# AGENTS.md
Lihat `ARCHITECTURE.md` dan `DESIGN.md` untuk konteks proyek lebih dalam — file ini
fokus ke *cara kerja* agent, bukan dokumentasi arsitektur.

## Prinsip kerja

- Ambil langkah kecil yang bisa diverifikasi. Jangan mengubah banyak
  komponen sekaligus lalu berharap semuanya benar.
- Kalau ambigu (misalnya requirement desain yang tidak jelas ukurannya),
  tanya dulu — jangan menebak lalu membangun di atas asumsi salah.

## Anti-slop

- Jangan tinggalkan `TODO`/`FIXME`/placeholder di kode tanpa memberi tahu
  user secara eksplisit di respons.
- Jangan hardcode data dummy untuk membuat sesuatu "kelihatan" jalan
  (misalnya foto placeholder base64 palsu, atau URL project yang mengarah
  ke tempat tidak ada).
- Jangan tambah dependency baru ke `package.json` kecuali benar-benar
  dipakai dan disebutkan ke user.
- Jangan klaim "sudah responsive" atau "sudah accessible" tanpa benar-benar
  memeriksa breakpoint mobile (`sm:`) dan fokus keyboard yang sudah jadi
  konvensi di project ini.

## Anti-loop

- Kalau sebuah pendekatan gagal 2x dengan error yang sama (misal error
  TypeScript yang sama setelah dua kali edit), STOP — jangan ulangi edit
  yang sama. Jelaskan dugaan root cause ke user atau ganti pendekatan.
- Sebelum retry apa pun, jelaskan singkat apa yang berbeda dari percobaan
  sebelumnya.
- Jika muncul 2x error tool_execution_failed: Detected 5 consecutive identical calls to `read_files`; stopping to avoid a loop. atau yang mirip seperti ini, cari dulu penyebab error nya, jika tidak ditemukan penyebabnya, skip dulu ke task yang lain.

## Definition of Done (wajib sebelum bilang "selesai")

Task terkait kode di project ini TIDAK boleh dinyatakan selesai kecuali:

1. `npm run lint` jalan tanpa error.
2. `npm run build` berhasil (proyek ini belum punya test suite — build
   sukses adalah baris pertahanan minimum untuk menangkap type error di
   TypeScript/Next.js).
3. Update semua dokumentasi kemudian commit & push
3. Tidak ada `console.log` yang tertinggal di kode non-debug.
4. Perintah-perintah di atas benar-benar dijalankan di sesi ini, bukan
   diasumsikan "harusnya jalan".
5. Kalau ada bagian yang tidak sempat diverifikasi (butuh `npm install`
   belum jalan di lingkungan ini, aset gambar belum ada, dsb), sebutkan
   itu eksplisit sebagai belum terverifikasi — jangan disamarkan sebagai
   selesai.

