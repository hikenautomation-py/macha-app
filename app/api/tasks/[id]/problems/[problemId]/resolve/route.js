import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// POST /api/tasks/{id}/problems/{problemId}/resolve (golongan >= 5)
export async function POST(req, { params }) {
  const { error } = await requireAtasan(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { keputusan } = body || {};

  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from('task_problems')
    .update({ status: 'resolved', keputusan: keputusan || null })
    .eq('id', params.problemId)
    .select('*')
    .single();

  if (err) return jsonError(500, 'INTERNAL', err.message);
  return jsonOk({ problemId: data.id, status: data.status });
}
