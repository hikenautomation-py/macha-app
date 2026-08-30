import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { ATASAN_TITLES, TITLE_OPTIONS, GOLONGAN_PELAKSANA_MAX } from '@/lib/constants';
import { getSubordinateIds } from '@/lib/hierarchy';

// PATCH /api/users/{id}/role — atasan terverifikasi menetapkan golongan/jabatan
// bawahan. Pendaftaran self-service dibatasi GOLONGAN_PELAKSANA_MAX; kenaikan ke
// level atasan (5-7) hanya lewat endpoint ini. Target harus di subtree bawahan
// dan golongan target harus lebih rendah dari si penyetuju.
export async function PATCH(req, { params }) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const targetId = params.id;
  if (!targetId) return jsonError(400, 'INVALID_ARGUMENT', 'id user wajib diisi');

  const admin = createAdminClient();
  const subs = await getSubordinateIds(admin, profile.id);
  if (!subs.includes(targetId)) {
    return jsonError(403, 'PERMISSION_DENIED', 'Target harus bawahan di subtree kamu (tidak bisa menetapkan level diri sendiri atau atasan lain)');
  }

  const body = await req.json().catch(() => ({}));
  const golonganRaw = body.golongan === undefined || body.golongan === null
    ? null
    : Number(body.golongan);
  const titleRaw = body.title === undefined || body.title === null
    ? null
    : String(body.title).trim();

  if (golonganRaw === null && titleRaw === null) {
    return jsonError(400, 'INVALID_ARGUMENT', 'Field golongan atau title wajib diisi');
  }
  if (golonganRaw !== null && (!Number.isInteger(golonganRaw) || golonganRaw < 1 || golonganRaw > 7)) {
    return jsonError(400, 'INVALID_ARGUMENT', 'golongan harus bilangan bulat 1-7');
  }
  if (golonganRaw !== null && golonganRaw >= Number(profile.golongan)) {
    return jsonError(403, 'PERMISSION_DENIED', `Golongan target harus lebih rendah dari kamu (level kamu ${profile.golongan})`);
  }
  if (titleRaw !== null && !TITLE_OPTIONS.includes(titleRaw)) {
    return jsonError(400, 'INVALID_ARGUMENT', 'title tidak ada di daftar jabatan');
  }

  const { data: existing } = await admin.from('users').select('*').eq('id', targetId).maybeSingle();
  if (!existing) return jsonError(404, 'NOT_FOUND', 'User tidak ditemukan');

  const gFinal = golonganRaw ?? (Number(existing.golongan) || 1);
  const titleFinal = titleRaw ?? existing.title ?? null;

  if (gFinal >= 5 && !ATASAN_TITLES.includes(titleFinal)) {
    return jsonError(400, 'INVALID_ARGUMENT', `Golongan >= 5 butuh jabatan atasan (SPV/Assistant Manager/Section Manager), dapat ${titleFinal || '(kosong)'}`);
  }
  if (gFinal <= GOLONGAN_PELAKSANA_MAX && ATASAN_TITLES.includes(titleFinal)) {
    return jsonError(400, 'INVALID_ARGUMENT', `Golongan pelaksana (<= ${GOLONGAN_PELAKSANA_MAX}) tidak cocok dengan jabatan atasan ${titleFinal}`);
  }

  await admin.from('users').update({ golongan: gFinal, title: titleFinal }).eq('id', targetId);

  // Jaga sinkron metadata auth user (best effort — Telegram-only user mungkin
  // tidak punya akun auth.users).
  try {
    await admin.auth.admin.updateUserById(targetId, {
      user_metadata: { ...(existing.user_metadata || {}), golongan: gFinal, title: titleFinal },
    });
  } catch {
    // abaikan — users table tetap sumber kebenaran.
  }

  return jsonOk({ id: targetId, golongan: gFinal, title: titleFinal });
}