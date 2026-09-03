import { isAtasan } from './constants';

/**
 * Ambil id semua bawahan rekursif dari seorang user (tidak termasuk user itu
 * sendiri), mengikuti edge `users.atasan_id` lewat RPC `get_subordinate_ids`.
 * Aman dipanggil tanpa migrasi (return [] bila RPC belum ada).
 */
export async function getSubordinateIds(admin, userId) {
  if (!admin || !userId) return [];
  try {
    const { data, error } = await admin.rpc('get_subordinate_ids', { p_root: userId });
    if (error) return [];
    return (data || []).map((r) => r.id);
  } catch {
    return [];
  }
}

/**
 * Id user yang boleh dilihat oleh profile (untuk query task/stats).
 * - Atasan: diri sendiri + seluruh subtree bawahan.
 * - Non-atasan: hanya diri sendiri.
 */
export async function getViewableUserIds(admin, profile) {
  if (!profile) return [];
  if (!isAtasan(profile)) return [profile.id];
  const subs = await getSubordinateIds(admin, profile.id);
  return [profile.id, ...subs];
}

/**
 * Filter PostgREST untuk task yang jadi tanggung jawab seorang atasan:
 * dibuat olehnya (`assigned_by`) ATAU dikerjakan salah satu bawahannya
 * (`assigned_to` di subtree). Task hasil pick-up laporan bisa punya
 * `assigned_by` kosong, jadi kepemilikan tidak boleh hanya bersandar ke sana.
 * Return null bila belum punya bawahan — pemanggil fallback ke `assigned_by`.
 */
export function taskScopeOr(profileId, subordinateIds) {
  if (!subordinateIds || !subordinateIds.length) return null;
  return `assigned_by.eq.${profileId},assigned_to.in.(${subordinateIds.join(',')})`;
}

/**
 * Versi in-memory dari `taskScopeOr` untuk baris task yang sudah diambil.
 */
export function canSuperviseTask(profile, task, subordinateIds) {
  if (!profile || !task) return false;
  if (task.assigned_by && task.assigned_by === profile.id) return true;
  return !!task.assigned_to && (subordinateIds || []).includes(task.assigned_to);
}

/**
 * Cek apakah targetUserId berada di subtree bawahan profile (atau profile itu
 * sendiri). Dipakai validasi assignment.
 */
export async function isWithinSubtree(admin, profile, targetUserId) {
  if (!profile || !targetUserId) return false;
  if (targetUserId === profile.id) return false; // tidak menugaskan ke diri sendiri
  const subs = await getSubordinateIds(admin, profile.id);
  return subs.includes(targetUserId);
}
