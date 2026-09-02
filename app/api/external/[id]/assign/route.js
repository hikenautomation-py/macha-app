import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createTaskFromExternal } from '@/lib/external';
import { getSubordinateIds } from '@/lib/hierarchy';

// POST /api/external/{id}/assign — atasan menugaskan bawahan menangani laporan
// umum/request (setara tombol Pick up di Telegram, tapi untuk orang lain).
export async function POST(req, { params }) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { assignedTo } = body || {};

  if (!assignedTo) {
    return jsonError(400, 'INVALID_ARGUMENT', 'assignedTo wajib diisi');
  }

  const admin = createAdminClient();

  const subs = await getSubordinateIds(admin, profile.id);
  if (!subs.includes(assignedTo)) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu hanya bisa menugaskan bawahan kamu');
  }

  const { data: row } = await admin
    .from('external_requests')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!row) return jsonError(404, 'NOT_FOUND', 'Laporan tidak ditemukan');
  if (row.status !== 'open') {
    return jsonError(409, 'CONFLICT', 'Laporan ini sudah diambil/ditutup');
  }

  const { task, error: createErr, conflict } = await createTaskFromExternal(admin, {
    row,
    assignedBy: profile.id,
    assignedTo,
  });

  if (createErr) {
    if (conflict) {
      return jsonError(409, 'CONFLICT', 'Laporan ini sudah diambil orang lain');
    }
    return jsonError(500, 'INTERNAL', createErr.message);
  }

  return jsonOk({ taskId: task.id, status: task.status });
}
