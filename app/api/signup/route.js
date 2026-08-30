import { jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { ATASAN_TITLES, GOLONGAN_PELAKSANA_MAX } from '@/lib/constants';

// POST /api/signup — daftar akun web via dashboard.
// Dilakukan server-side dengan service role dan langsung menandai email sebagai
// TERCANFIRM (email_confirm: true), karena mayoritas pelaksana (golongan 1-4)
// internetnya diblokir IT sehingga tidak bisa meng-klik link konfirmasi email.
// Tanpa ini mereka tidak akan pernah bisa login. Email konfirmasi (yang
// redirect-nya rawan http://localhost) juga tidak dikirim oleh admin.createUser.
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const { email, password, nama, npk, golongan, title } = body || {};

  if (!email || !String(email).includes('@')) {
    return jsonError(400, 'INVALID_ARGUMENT', 'Email wajib diisi dengan format benar.');
  }
  if (!password || String(password).length < 6) {
    return jsonError(400, 'INVALID_ARGUMENT', 'Password minimal 6 karakter.');
  }
  if (!String(nama || '').trim()) {
    return jsonError(400, 'INVALID_ARGUMENT', 'Nama wajib diisi.');
  }

  // Keamanan (P0): pendaftaran web self-service — level atasan tidak bisa diklaim
  // sendiri. Maksimal golongan pelaksana GOLONGAN_PELAKSANA_MAX; golongan 5-7
  // & jabatan SPV/ASM/SM ditetapkan lewat PATCH /api/users/{id}/role oleh atasan.
  const parsedG = golongan === null || golongan === undefined
    ? null
    : Number(golongan);
  if (parsedG !== null && (!Number.isInteger(parsedG) || parsedG < 1 || parsedG > GOLONGAN_PELAKSANA_MAX)) {
    return jsonError(400, 'INVALID_ARGUMENT', `Golongan saat pendaftaran hanya 1-${GOLONGAN_PELAKSANA_MAX} (pelaksana). Golongan 5-7 (SPV/ASM/SM) ditetapkan oleh atasan terverifikasi setelah daftar.`);
  }
  const titleClean = String(title || '').trim();
  if (ATASAN_TITLES.includes(titleClean)) {
    return jsonError(400, 'INVALID_ARGUMENT', `Jabatan ${titleClean} tidak bisa diklaim sendiri saat pendaftaran — ditetapkan oleh atasan terverifikasi.`);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: String(email).trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      nama: String(nama).trim(),
      npk: String(npk || '').trim(),
      golongan: parsedG ?? 1,
      title: titleClean || null,
    },
  });

  if (error) {
    const code = error.message?.toLowerCase().includes('already registered') ? 'ALREADY_EXISTS' : 'INVALID_ARGUMENT';
    return jsonError(code === 'ALREADY_EXISTS' ? 409 : 400, code, error.message);
  }

  // JAMIN baris public.users dengan id == auth uid ada, karena login web mencari
  // profil lewat id ini. Trigger on_auth_user_created idealnya sudah membuatnya,
  // tapi bisa gagal senyap kalau npk bentrok dengan baris lama (mis. dari
  // registrasi Telegram) sehingga login web tidak menemukan profil.
  const uid = data.user.id;
  const profile = {
    id: uid,
    email: data.user.email || null,
    nama: String(nama).trim(),
    npk: String(npk || '').trim() || null,
    golongan: parsedG ?? 1,
    title: titleClean || null,
  };
  const { error: upErr } = await admin.from('users').upsert(profile, { onConflict: 'id' });
  if (upErr) {
    // npk sudah dipakai baris lain -> reparent baris itu ke uid (gabungkan akun).
    await admin.from('users').update({ id: uid, email: profile.email }).eq('npk', profile.npk);
  }

  return jsonOk({ userId: uid });
}