import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { userTitle } from '@/lib/constants';
import { getSubordinateIds } from '@/lib/hierarchy';

// GET /api/teams/{id}/stats?month=yyyy-mm — statistik seluruh bawahan rekursif.
// Hanya atasan yang boleh melihat; `id` harus dirinya sendiri (tidak boleh
// mengintip tim atasan lain).
export async function GET(req, { params }) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  if (params.id !== profile.id) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu hanya bisa melihat statistik tim sendiri');
  }

  const url = new URL(req.url);
  const month = url.searchParams.get('month');

  const admin = createAdminClient();
  const subordinateIds = await getSubordinateIds(admin, profile.id);
  if (!subordinateIds.length) return jsonOk([]);

  // 2 query batch (bukan N+1 per bawahan): profil semua bawahan + seluruh
  // baris poin mereka sekaligus, lalu diagregasi di memori.
  let q = admin.from('points_history').select('user_id, points').in('user_id', subordinateIds);
  if (month) {
    const [y, m] = month.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      const start = `${month}-01`;
      const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      q = q.gte('created_at', start).lt('created_at', end);
    }
  }

  const [{ data: bawahan }, { data: rows }] = await Promise.all([
    admin.from('users').select('id, nama, golongan, title').in('id', subordinateIds),
    q,
  ]);

  const poinById = {};
  for (const r of rows || []) {
    poinById[r.user_id] = (poinById[r.user_id] || 0) + (r.points || 0);
  }

  const byId = Object.fromEntries((bawahan || []).map((b) => [b.id, b]));
  const result = subordinateIds
    .map((id) => byId[id])
    .filter(Boolean)
    .map((b) => ({ userId: b.id, nama: b.nama, golongan: b.golongan, title: userTitle(b), poin: poinById[b.id] || 0 }));

  return jsonOk(result);
}
