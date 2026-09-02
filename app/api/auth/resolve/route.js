import { jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// POST /api/auth/resolve — Resolve email address from either Email or NPK.
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const { identifier } = body || {};

  if (!identifier || !String(identifier).trim()) {
    return jsonError(400, 'INVALID_ARGUMENT', 'Email atau NPK wajib diisi.');
  }

  const cleanId = String(identifier).trim();

  // If input contains '@', treat as direct email
  if (cleanId.includes('@')) {
    return jsonOk({ email: cleanId.toLowerCase() });
  }

  // If input is NPK, look up email in public.users table
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('email')
    .eq('npk', cleanId)
    .maybeSingle();

  if (error) {
    return jsonError(500, 'INTERNAL', 'Gagal memproses pencarian akun.');
  }

  if (!data || !data.email) {
    return jsonError(404, 'NOT_FOUND', `NPK ${cleanId} tidak terdaftar di sistem.`);
  }

  return jsonOk({ email: data.email });
}
