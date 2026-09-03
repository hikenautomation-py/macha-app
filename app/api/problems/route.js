import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getSubordinateIds, canSuperviseTask } from '@/lib/hierarchy';

// GET /api/problems?status=open — daftar problem report pada task yang jadi
// tanggung jawab atasan yang sedang login: dia yang menugaskan ATAU
// pelaksananya bawahannya (task-bound problem reports).
export async function GET(req) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'open';

  const admin = createAdminClient();
  const { data: problems, error: err } = await admin
    .from('task_problems')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (err) return jsonError(500, 'INTERNAL', err.message);

  const subs = await getSubordinateIds(admin, profile.id);
  const result = [];
  for (const p of problems || []) {
    const { data: task } = await admin
      .from('tasks')
      .select('title, assigned_by, assigned_to')
      .eq('id', p.task_id)
      .maybeSingle();
    if (!canSuperviseTask(profile, task, subs)) continue;
    const { data: u } = await admin.from('users').select('nama').eq('id', p.user_id).maybeSingle();
    result.push({
      problemId: p.id,
      taskId: p.task_id,
      judul: task.title,
      namaPelapor: u?.nama || null,
      urgensi: p.urgency,
      deskripsiMasalah: p.description,
      status: p.status,
      keputusan: p.keputusan,
      createdAt: p.created_at,
    });
  }

  return jsonOk(result);
}
