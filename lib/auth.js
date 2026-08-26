import { NextResponse } from 'next/server';
import { verifyToken, createAdminClient } from './supabase';
import { isAtasan } from './constants';

export function jsonError(status, code, message) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

export function jsonOk(data, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Ambil + verifikasi user dari header Authorization, lalu ambil profil dari
 * tabel users (golongan, atasan_id, telegram_chat_id, dst).
 */
export async function requireAuth(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return { error: jsonError(401, 'UNAUTHENTICATED', 'Token tidak ditemukan') };
  }

  const user = await verifyToken(token);
  if (!user) {
    return { error: jsonError(401, 'UNAUTHENTICATED', 'Token tidak valid / kedaluwarsa') };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile };
}

/**
 * Sama seperti requireAuth, plus cek status atasan
 * (golongan >= 5 DAN title SPV ke atas).
 */
export async function requireAtasan(req) {
  const { user, profile, error } = await requireAuth(req);
  if (error) return { error };
  if (!isAtasan(profile)) {
    return {
      error: jsonError(403, 'PERMISSION_DENIED', 'Kamu bukan atasan (perlu golongan >= 5 dengan title SPV ke atas)'),
    };
  }
  return { user, profile };
}
