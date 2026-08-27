import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getSubordinateIds } from '@/lib/hierarchy';

// GET /api/dashboard/summary — satu payload untuk metric card dashboard atasan.
export async function GET(req) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const admin = createAdminClient();
  const subordinateIds = await getSubordinateIds(admin, profile.id);

  const { data: taskAktif } = await admin
    .from('tasks')
    .select('id')
    .eq('assigned_by', profile.id)
    .in('status', ['assigned', 'in_progress', 'rejected']);

  const { data: menunggu } = await admin
    .from('tasks')
    .select('id')
    .eq('assigned_by', profile.id)
    .eq('status', 'report_submitted');

  const { data: problems } = await admin
    .from('task_problems')
    .select('id')
    .eq('status', 'open');

  let problemOpen = 0;
  for (const p of problems || []) {
    const { data: t } = await admin.from('tasks').select('assigned_by').eq('id', p.task_id).maybeSingle();
    if (t?.assigned_by === profile.id) problemOpen += 1;
  }

  const { data: externalOpen } = await admin
    .from('external_requests')
    .select('id')
    .eq('status', 'open');

  let totalPoinTim = 0;
  for (const id of subordinateIds) {
    const { data: rows } = await admin
      .from('points_history')
      .select('points')
      .eq('user_id', id)
      .gte('created_at', start)
      .lt('created_at', end);
    totalPoinTim += (rows || []).reduce((s, r) => s + (r.points || 0), 0);
  }

  return jsonOk({
    taskAktif: (taskAktif || []).length,
    menungguApproval: (menunggu || []).length,
    problemOpen,
    anggotaTim: subordinateIds.length,
    totalPoinTim,
    externalOpen: (externalOpen || []).length,
  });
}
