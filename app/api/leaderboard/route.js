import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/leaderboard?month=yyyy-mm
// Ranking poin bulanan seluruh user (gamifikasi bersifat terbuka: semua user
// login boleh lihat ranking, seperti papan skor fisik di lantai produksi).
export async function GET(req) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const url = new URL(req.url);
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  if (Number.isNaN(y) || Number.isNaN(m)) {
    return jsonError(400, 'VALIDATION', 'Parameter month harus format yyyy-mm');
  }
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const admin = createAdminClient();

  const [{ data: rows, error: e1 }, { data: users, error: e2 }, { data: awards }] = await Promise.all([
    admin.from('points_history').select('user_id, points').gte('created_at', start).lt('created_at', end),
    admin.from('users').select('id, nama, title, golongan'),
    admin.from('user_badges').select('user_id, badges(code, nama, emoji)'),
  ]);
  if (e1) return jsonError(500, 'INTERNAL', e1.message);
  if (e2) return jsonError(500, 'INTERNAL', e2.message);

  const totals = new Map();
  for (const r of rows || []) {
    totals.set(r.user_id, (totals.get(r.user_id) || 0) + (r.points || 0));
  }
  const badgesByUser = new Map();
  for (const a of awards || []) {
    if (!a.badges) continue;
    const list = badgesByUser.get(a.user_id) || [];
    list.push({ code: a.badges.code, nama: a.badges.nama, emoji: a.badges.emoji });
    badgesByUser.set(a.user_id, list);
  }

  const ranking = (users || [])
    .map((u) => ({
      userId: u.id,
      nama: u.nama,
      title: u.title,
      golongan: u.golongan,
      totalPoin: totals.get(u.id) || 0,
      badges: badgesByUser.get(u.id) || [],
    }))
    .filter((u) => u.totalPoin > 0 || u.badges.length > 0)
    .sort((a, b) => b.totalPoin - a.totalPoin)
    .map((u, i) => ({ peringkat: i + 1, ...u }));

  return jsonOk({ month, ranking });
}
