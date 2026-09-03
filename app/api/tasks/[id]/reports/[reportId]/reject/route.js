import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { notifyTelegram } from '@/lib/telegram';
import { emailTaskRejected } from '@/lib/email';
import { getSubordinateIds, canSuperviseTask } from '@/lib/hierarchy';

// POST /api/tasks/{id}/reports/{reportId}/reject (atasan terkait, golongan >= 5)
export async function POST(req, { params }) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { catatanRevisi } = body || {};

  const admin = createAdminClient();
  const { data: task } = await admin
    .from('tasks')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!task) return jsonError(404, 'NOT_FOUND', 'Task tidak ditemukan');
  // Sama seperti approve: pembuat task ATAU atasan si pelaksana.
  const subs = await getSubordinateIds(admin, profile.id);
  if (!canSuperviseTask(profile, task, subs)) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu bukan atasan dari task ini');
  }
  // Hanya report yang masih menunggu approval yang bisa di-reject —
  // mencegah reject berulang (state korup + notifikasi spam).
  if (task.status !== 'report_submitted') {
    return jsonError(409, 'INVALID_ARGUMENT', 'Task tidak dalam status menunggu approval');
  }
  const { data: report } = await admin
    .from('task_reports')
    .select('id, status')
    .eq('id', params.reportId)
    .eq('task_id', params.id)
    .maybeSingle();
  if (!report) return jsonError(404, 'NOT_FOUND', 'Report tidak ditemukan');
  if (report.status !== 'report_submitted') {
    return jsonError(409, 'INVALID_ARGUMENT', 'Report ini sudah diproses');
  }

  // Status task kembali ke in_progress; report ditandai rejected.
  await admin.from('tasks').update({ status: 'in_progress' }).eq('id', params.id);
  await admin.from('task_reports').update({ status: 'rejected' }).eq('id', params.reportId);

  if (task.assigned_to) {
    const { data: pelaksana } = await admin
      .from('users')
      .select('*')
      .eq('id', task.assigned_to)
      .maybeSingle();
    if (pelaksana?.telegram_chat_id) {
      await notifyTelegram(
        admin,
        pelaksana.telegram_chat_id,
        `↩️ <b>Perlu revisi</b>\n${task.title}${catatanRevisi ? `\n\nCatatan: ${catatanRevisi}` : ''}`
      );
    }
    // Email notifikasi hasil approval (revisi) ke pelaksana.
    await emailTaskRejected(admin, task.assigned_to, task, catatanRevisi);
  }

  return jsonOk({ status: 'rejected' });
}
