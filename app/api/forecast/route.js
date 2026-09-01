import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getViewableUserIds } from '@/lib/hierarchy';
import { KPI_CATEGORIES, KPI_CATEGORY_LABEL, POINT_RULES_DEFAULT, levelFromGolongan } from '@/lib/points';

// GET /api/forecast
// Proyeksi sederhana (moving average, tanpa ML):
// - velocity poin & task 3 bulan terakhir per bulan
// - proyeksi bulan berjalan & kuartal
// - status on-track / at-risk per kategori KPI (aktual vs bobot level)
export async function GET(req) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1)).toISOString().slice(0, 10);

  const admin = createAdminClient();
  const viewable = await getViewableUserIds(admin, profile);

  const [{ data: hist, error: e1 }, { data: tasks, error: e2 }] = await Promise.all([
    admin.from('points_history').select('points, created_at').in('user_id', viewable).gte('created_at', start),
    admin.from('tasks').select('kpi_category, points, status, created_at').in('assigned_to', viewable).eq('status', 'approved').gte('created_at', start),
  ]);
  if (e1) return jsonError(500, 'INTERNAL', e1.message);
  if (e2) return jsonError(500, 'INTERNAL', e2.message);

  // Velocity per bulan (3 bulan penuh terakhir, exclude bulan berjalan).
  const bulanIni = now.toISOString().slice(0, 7);
  const perBulan = new Map();
  for (const r of hist || []) {
    const key = String(r.created_at).slice(0, 7);
    const cur = perBulan.get(key) || { poin: 0, task: 0 };
    cur.poin += r.points || 0;
    cur.task += 1;
    perBulan.set(key, cur);
  }
  const velocity = [...perBulan.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bulan, v]) => ({ bulan, ...v, berjalan: bulan === bulanIni }));

  const histBulanPenuh = velocity.filter((v) => !v.berjalan);
  const avgPoin = histBulanPenuh.length
    ? histBulanPenuh.reduce((s, v) => s + v.poin, 0) / histBulanPenuh.length
    : 0;
  const avgTask = histBulanPenuh.length
    ? histBulanPenuh.reduce((s, v) => s + v.task, 0) / histBulanPenuh.length
    : 0;

  const proyeksi = {
    poinPerBulan: Math.round(avgPoin),
    taskPerBulan: Math.round(avgTask),
    poinKuartal: Math.round(avgPoin * 3),
    taskKuartal: Math.round(avgTask * 3),
  };

  // On-track / at-risk per kategori KPI: bandingkan share poin aktual vs bobot
  // level user login (sheet "Bobot KPI"). At-risk bila aktual < 60% bobot.
  const catTotal = Object.fromEntries(KPI_CATEGORIES.map((c) => [c, 0]));
  let catSum = 0;
  for (const t of tasks || []) {
    if (t.kpi_category && catTotal[t.kpi_category] !== undefined) {
      catTotal[t.kpi_category] += t.points || 0;
      catSum += t.points || 0;
    }
  }
  const bobot = POINT_RULES_DEFAULT[levelFromGolongan(profile.golongan)];
  const kategoriStatus = KPI_CATEGORIES.map((c) => {
    const aktualShare = catSum > 0 ? catTotal[c] / catSum : 0;
    const target = bobot[c] || 0;
    return {
      kategori: c,
      label: KPI_CATEGORY_LABEL[c],
      aktualPct: Math.round(aktualShare * 100),
      targetPct: Math.round(target * 100),
      status: catSum === 0 ? 'belum_ada_data' : aktualShare >= target * 0.6 ? 'on_track' : 'at_risk',
    };
  });

  return jsonOk({ velocity, proyeksi, kategoriStatus });
}
