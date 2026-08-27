import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// GET /api/problems?status=open — daftar problem report pada task yang
// `assigned_by` = atasan yang sedang login (task-bound problem reports).
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

  const result = [];
  for (const p of problems || []) {
    const { data: task } = await admin.from('tasks').select('title, assigned_by').eq('id', p.task_id).maybeSingle();
    if (!task || task.assigned_by !== profile.id) continue;
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
