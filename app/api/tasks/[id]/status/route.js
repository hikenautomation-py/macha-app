import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { mapTask } from '@/lib/mappers';

const VALID = ['assigned', 'in_progress', 'report_submitted', 'approved', 'rejected'];

// PATCH /api/tasks/{id}/status — ubah status task (golongan >= 5)
export async function PATCH(req, { params }) {
  const { error } = await requireAtasan(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { status } = body || {};

  if (!VALID.includes(status)) {
    return jsonError(400, 'INVALID_ARGUMENT', 'status tidak valid');
  }

  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from('tasks')
    .update({ status })
    .eq('id', params.id)
    .select('*')
    .single();

  if (err) return jsonError(500, 'INTERNAL', err.message);
  return jsonOk(mapTask(data));
}
