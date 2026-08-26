import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { isAtasan } from '@/lib/constants';

// GET /api/users/{id}/points?month=yyyy-mm
// Semua user hanya boleh lihat poin sendiri; atasan boleh lihat bawahan.
export async function GET(req, { params }) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  if (!isAtasan(profile) && params.id !== profile.id) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu hanya bisa melihat poin sendiri');
  }

  const url = new URL(req.url);
  const month = url.searchParams.get('month'); // yyyy-mm

  const admin = createAdminClient();
  let q = admin.from('points_history').select('points, created_at').eq('user_id', params.id);

  if (month) {
    const [y, m] = month.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      const start = `${month}-01`;
      const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // hari pertama bulan berikutnya
      q = q.gte('created_at', start).lt('created_at', end);
    }
  }

  const { data, error: err } = await q;
  if (err) return jsonError(500, 'INTERNAL', err.message);

  const totalPoin = (data || []).reduce((s, r) => s + (r.points || 0), 0);
  const jumlahTaskSelesai = (data || []).length;

  return jsonOk({ totalPoin, jumlahTaskSelesai });
}
