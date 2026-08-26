import { jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// POST /api/signup — daftar akun web via dashboard.
// Dilakukan server-side dengan service role dan langsung menandai email sebagai
// TERCANFIRM (email_confirm: true), karena mayoritas pelaksana (golongan 1-5)
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

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: String(email).trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      nama: String(nama).trim(),
      npk: String(npk || '').trim(),
      golongan: Number(golongan) || 1,
      title: String(title || '').trim() || null,
    },
  });

  if (error) {
    const code = error.message?.toLowerCase().includes('already registered') ? 'ALREADY_EXISTS' : 'INVALID_ARGUMENT';
    return jsonError(code === 'ALREADY_EXISTS' ? 409 : 400, code, error.message);
  }

  // Row public.users dibuat otomatis oleh trigger on_auth_user_created.
  return jsonOk({ userId: data.user.id });
}