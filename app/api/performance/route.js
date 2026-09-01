import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getViewableUserIds } from '@/lib/hierarchy';
import { KPI_CATEGORIES, POINT_RULES_DEFAULT, levelFromGolongan } from '@/lib/points';

// GET /api/performance?months=6
// Agregasi performa untuk user login (atau seluruh subtree bila atasan):
// - trend: poin per bulan (n bulan terakhir)
// - kategori: distribusi poin approved per kategori KPI vs bobot level
// - perUser: total poin + task selesai per user (untuk atasan)
export async function GET(req) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  const url = new URL(req.url);
  const months = Math.min(12, Math.max(1, Number(url.searchParams.get('months')) || 6));

  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const start = startDate.toISOString().slice(0, 10);

  const admin = createAdminClient();
  const viewable = await getViewableUserIds(admin, profile);

  const [{ data: hist, error: e1 }, { data: tasks, error: e2 }, { data: users, error: e3 }] = await Promise.all([
    admin.from('points_history').select('user_id, points, created_at').in('user_id', viewable).gte('created_at', start),
    admin.from('tasks').select('assigned_to, kpi_category, status, points').in('assigned_to', viewable).eq('status', 'approved').gte('created_at', start),
    admin.from('users').select('id, nama, golongan, title').in('id', viewable),
  ]);
  if (e1) return jsonError(500, 'INTERNAL', e1.message);
  if (e2) return jsonError(500, 'INTERNAL', e2.message);
  if (e3) return jsonError(500, 'INTERNAL', e3.message);

  // Tren poin per bulan.
  const trendMap = new Map();
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1));
    trendMap.set(d.toISOString().slice(0, 7), 0);
  }
  for (const r of hist || []) {
    const key = String(r.created_at).slice(0, 7);
    if (trendMap.has(key)) trendMap.set(key, trendMap.get(key) + (r.points || 0));
  }
  const trend = [...trendMap.entries()].map(([bulan, poin]) => ({ bulan, poin }));

  // Distribusi kategori KPI (dari tasks approved) vs bobot level user login.
  const catTotal = Object.fromEntries(KPI_CATEGORIES.map((c) => [c, 0]));
  let catSum = 0;
  for (const t of tasks || []) {
    if (t.kpi_category && catTotal[t.kpi_category] !== undefined) {
      catTotal[t.kpi_category] += t.points || 0;
      catSum += t.points || 0;
    }
  }
  const bobot = POINT_RULES_DEFAULT[levelFromGolongan(profile.golongan)];
  const kategori = KPI_CATEGORIES.map((c) => ({
    kategori: c,
    poin: catTotal[c],
    aktualPct: catSum > 0 ? Math.round((catTotal[c] / catSum) * 100) : 0,
    bobotPct: Math.round((bobot[c] || 0) * 100),
  }));

  // Ringkasan per user (berguna untuk atasan; non-atasan hanya dirinya).
  const byUser = new Map();
  for (const r of hist || []) {
    const cur = byUser.get(r.user_id) || { poin: 0, taskSelesai: 0 };
    cur.poin += r.points || 0;
    cur.taskSelesai += 1;
    byUser.set(r.user_id, cur);
  }
  const perUser = (users || [])
    .map((u) => ({ userId: u.id, nama: u.nama, title: u.title, ...(byUser.get(u.id) || { poin: 0, taskSelesai: 0 }) }))
    .sort((a, b) => b.poin - a.poin);

  return jsonOk({ months, trend, kategori, perUser });
}
