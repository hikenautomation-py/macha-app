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

  const result = [];
  for (const id of subordinateIds) {
    const { data: b } = await admin
      .from('users')
      .select('id, nama, golongan, title')
      .eq('id', id)
      .maybeSingle();
    if (!b) continue;
    let q = admin.from('points_history').select('points').eq('user_id', id);
    if (month) {
      const [y, m] = month.split('-').map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m)) {
        const start = `${month}-01`;
        const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
        q = q.gte('created_at', start).lt('created_at', end);
      }
    }
    const { data: rows } = await q;
    const poin = (rows || []).reduce((s, r) => s + (r.points || 0), 0);
    result.push({ userId: b.id, nama: b.nama, golongan: b.golongan, title: userTitle(b), poin });
  }

  return jsonOk(result);
}
