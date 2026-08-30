# Design system — Task Tracker Production Engineering

> Sumber: `PROJECT_BRIEF.md` bagian "Design tokens" + `mockup.html`. Token ini diimplementasikan sebagai CSS custom properties di `app/globals.css`.

---

## 1. Warna

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
| `--sky-ink` | `#2B5D82` | Teks di atas sky tint (info netral) |

---

## 2. Tipografi

| Role | Font | Penggunaan |
|---|---|---|
| Display / heading | `Baloo 2` (500/600/700) | Judul halaman, judul task, greeting |
| Body | `Plus Jakarta Sans` (400/500/600/700) | Paragraf, label, tombol |
| Data / angka | `JetBrains Mono` (500/600) | Poin, NPK, angka statistik |

Font direferensikan lewat system font stack di `app/globals.css` (`--font-head`, `--font-body`, `--font-mono`): nama font target (Baloo 2 / Plus Jakarta Sans / JetBrains Mono) dipakai sebagai preferensi pertama, lalu fallback ke font sistem. Tidak lagi memakai `next/font/google` agar `next build` tidak bergantung pada unduhan font dari jaringan (rawan hang saat jaringan lambat).

---

## 3. Layout & bentuk

- **Radius card**: `20px` (`--radius-card`)
- **Radius kontrol/input**: `12px` (`--radius-ctrl`)
- **Badge/pill**: `999px` (full round)
- **Card utama**: border `1px solid var(--border)`, tanpa shadow default.
- **Shadow**: hanya muncul saat hover pada elemen interaktif (ticket card): `0 8px 20px rgba(31,78,68,.08)` + `transform: translateY(-2px)`.

### Ticket card (elemen signature)
Task ditampilkan sebagai "tiket" meniru tiket fisik:
- Body card (`.ticket`) flex, `border-radius: var(--radius-card)`, overflow hidden.
- Bagian utama (`.t-main`) berisi judul + meta + badge status.
- "Stub" (`.t-stub`) di kanan, lebar ~84px, latar `--amber-tint`, `border-left: 2px dashed #D9C298`, berisi angka poin (JetBrains Mono).
- Dua lingkaran "lubang sobekan" (`::before`/`::after`) di tepi stub, warna `--bg`.
- Varian problem report: stub latar `--coral-tint`, `border-left-color: #E9B7AA`, berisi ikon panah.

### Responsif
- **Mobile-first** untuk semua tampilan pelaksana: dibungkus frame `phone` (max-width 380px), `border-radius 32px`, `box-shadow 0 20px 50px rgba(31,43,36,.08)`, `phone-inner` latar `--bg` radius 22px.
- **Desktop/wide** untuk dashboard atasan (max-width ~1080px, metric grid auto-fit minmax 140px).

---

## 4. Prinsip UI

- **Konsistensi warna status**:
  - teal = assigned / task baru
  - sky = in progress / sedang dikerjakan
  - amber = menunggu approval
  - coral = problem / danger
- **Microcopy percakapan**, bukan formal kaku — contoh: "Yuk mulai, kenalan dulu", "Semangat hari ini!", "Ceritain progressnya".
- **Tanpa tekanan berlebihan** — tidak ada countdown merah mencolok, tidak ada red badge angka besar (kecuali problem report yang memang harus menonjol).
- Badge memakai ikon/emoji untuk memperjelas status (implementasi aktual memakai emoji, menggantikan Tabler Icons yang dipakai di `mockup.html`).

---

## 5. Pola komponen (dari mockup)

| Komponen | Kelas/pola |
|---|---|
| Tab bar | `.tabbar` pill, `.tab.active` latar `--teal` |
| Button primary | `.btn.btn-primary` latar `--teal`, hover `--teal-dark` |
| Button danger | `.btn-danger-outline` border `--coral`, teks `--coral-ink` |
| Metric block | `.metric` latar `--surface-tint` radius 16px, angka heading 26px |
| Greeting blob | `.greet-blob` gradient `135deg teal→teal-dark`, radius 24px, ornamen lingkaran `::after` |
| Urgency pick | `.urgency-opt` 3 pilihan; picked: low=teal, mid=amber, high=coral |
| Stamp note | `.stamp-note` latar `--sky-tint` (info) / `--coral-tint` (masalah) |
| Table statistik | `.tidy` 13px, header teks `--ink-soft`, angka pakai mono |
| Error state | `.err` teks 12px `--coral-ink`, muncul saat validasi gagal |
| Modal dialog | `.modal-backdrop` latar hitam transparan + `.modal` kartu rounded dengan `role="dialog"`, `aria-modal`, `aria-labelledby`; Esc / klik backdrop tutup |

---

## 6. Halaman & urutan (sesuai mockup)

1. **Login / Registrasi** — form email/password (login) + nama, NPK, golongan, title/jabatan (daftar) + stamp note: "belum punya akun? daftar, atau ketik /start di bot Telegram dan masukkan NPK untuk menautkan akun".
2. **Dashboard atasan** — greeting, tombol "Buat task baru" + "Kelola tim", 4 metric card (Task aktif, Menunggu approval, Problem report, Poin tim bulan ini), antrian approval (ticket), section problem report (task), section laporan umum & request (dengan tombol `Resolve` / `Assign to` per item; tombol `Assign to` membuka **modal** dengan `<select>` anggota tim), tabel statistik tim.
3. **Dashboard technician** — greeting blob, daftar "Task kamu hari ini" (ticket), 2 tombol aksi (Lapor selesai / Lapor masalah), kartu "Poin bulan ini", **sidebar "Laporan umum & request"** dengan tombol `🙋 Pick up` per item (status busy + pesan error inline saat gagal).
4. **Lapor selesai** — kartu konteks task (teal tint), textarea catatan (wajib), upload foto (opsional), tombol "Kirim untuk approval", stamp note poin.
5. **Lapor masalah** — kartu konteks task (coral tint), urgency pick, textarea deskripsi (wajib), tombol "Kirim ke atasan", stamp note prioritas tinggi.
6. **Kelola tim** — daftar team + form buat team (nama + lead), kelola anggota (tambah/hapus bawahan).
7. **Laporan umum (publik)** — form nama + NPK + deskripsi masalah, tampil dalam frame phone (mobile-first).
8. **Permintaan improvement (publik)** — form nama + NPK + deskripsi improvement.
9. **Modal dialog (pick up/assign)** — `.modal-backdrop` (latar gelap, klik tutup) + `.modal` (kartu putih rounded, `aria-modal="true"`, `aria-labelledby`, tombol Esc untuk tutup) — dipakai dashboard atasan saat Assign to.
