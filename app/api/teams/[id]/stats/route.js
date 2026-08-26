import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { userTitle } from '@/lib/constants';

// GET /api/teams/{id}/stats?month=yyyy-mm — statistik bawahan (golongan >= 5)
export async function GET(req, { params }) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const atasanId = params.id || profile.id;
  const url = new URL(req.url);
  const month = url.searchParams.get('month');

  const admin = createAdminClient();
  const { data: bawahan, error: err } = await admin
    .from('users')
    .select('id, nama, golongan, title')
    .eq('atasan_id', atasanId);

  if (err) return jsonError(500, 'INTERNAL', err.message);

  const result = [];
  for (const b of bawahan || []) {
    let q = admin.from('points_history').select('points').eq('user_id', b.id);
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
