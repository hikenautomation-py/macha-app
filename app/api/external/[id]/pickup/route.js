import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createTaskFromExternal } from '@/lib/external';

// POST /api/external/{id}/pickup — user (technician) pick up laporan umum/request
// untuk dirinya sendiri, sama seperti tombol Pick up di Telegram.
export async function POST(req, { params }) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('external_requests')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!row) return jsonError(404, 'NOT_FOUND', 'Laporan tidak ditemukan');
  if (row.status !== 'open') {
    return jsonError(409, 'CONFLICT', 'Laporan ini sudah diambil/ditutup');
  }

  const { task, error: createErr } = await createTaskFromExternal(admin, {
    row,
    assignedBy: profile.atasan_id || null,
    assignedTo: profile.id,
  });

  if (createErr) {
    if (createErr.conflict) {
      return jsonError(409, 'CONFLICT', 'Laporan ini sudah diambil orang lain');
    }
    return jsonError(500, 'INTERNAL', createErr.message);
  }

  return jsonOk({ taskId: task.id, status: task.status });
}
