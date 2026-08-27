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
 * Cek apakah targetUserId berada di subtree bawahan profile (atau profile itu
 * sendiri). Dipakai validasi assignment.
 */
export async function isWithinSubtree(admin, profile, targetUserId) {
  if (!profile || !targetUserId) return false;
  if (targetUserId === profile.id) return false; // tidak menugaskan ke diri sendiri
  const subs = await getSubordinateIds(admin, profile.id);
  return subs.includes(targetUserId);
}
