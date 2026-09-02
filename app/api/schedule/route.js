import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getViewableUserIds } from '@/lib/hierarchy';

// GET /api/schedule?weeks=2
// Agenda task aktif (assigned/in_progress/report_submitted) untuk n minggu ke
// depan + beban per user. Scope: diri sendiri, atau seluruh subtree bila atasan.
export async function GET(req) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  const url = new URL(req.url);
  const weeks = Math.min(8, Math.max(1, Number(url.searchParams.get('weeks')) || 2));

  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + weeks * 7 * 86400000).toISOString().slice(0, 10);

  const admin = createAdminClient();
  const viewable = await getViewableUserIds(admin, profile);

  const [{ data: tasks, error: e1 }, { data: users, error: e2 }] = await Promise.all([
    admin
      .from('tasks')
      .select('id, title, assigned_to, status, points, deadline, kpi_category, created_at')
      .in('assigned_to', viewable)
      .in('status', ['assigned', 'in_progress', 'report_submitted'])
      .order('deadline', { ascending: true, nullsFirst: false }),
    admin.from('users').select('id, nama, title').in('id', viewable),
  ]);
  if (e1) return jsonError(500, 'INTERNAL', e1.message);
  if (e2) return jsonError(500, 'INTERNAL', e2.message);

  const namaById = new Map((users || []).map((u) => [u.id, u.nama]));

  const agenda = (tasks || []).map((t) => ({
    taskId: t.id,
    judul: t.title,
    pelaksana: namaById.get(t.assigned_to) || '—',
    userId: t.assigned_to,
    status: t.status,
    poin: t.points || 0,
    deadline: t.deadline,
    mulai: t.created_at ? t.created_at.slice(0, 10) : null,
    kategoriKPI: t.kpi_category,
    terlambat: Boolean(t.deadline && t.deadline < today),
    dalamJendela: Boolean(t.deadline && t.deadline >= today && t.deadline <= until),
  }));

  // Beban per user: jumlah task aktif + total poin berjalan.
  const bebanMap = new Map();
  for (const t of agenda) {
    const cur = bebanMap.get(t.userId) || { taskAktif: 0, totalPoin: 0, terlambat: 0 };
    cur.taskAktif += 1;
    cur.totalPoin += t.poin;
    if (t.terlambat) cur.terlambat += 1;
    bebanMap.set(t.userId, cur);
  }
  const beban = (users || [])
    .map((u) => ({ userId: u.id, nama: u.nama, title: u.title, ...(bebanMap.get(u.id) || { taskAktif: 0, totalPoin: 0, terlambat: 0 }) }))
    .sort((a, b) => b.taskAktif - a.taskAktif);

  return jsonOk({ weeks, sampai: until, agenda, beban });
}
