import { requireGolongan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { notifyTelegram } from '@/lib/telegram';
import { emailTaskRejected } from '@/lib/email';

// POST /api/tasks/{id}/reports/{reportId}/reject (atasan terkait, golongan >= 5)
export async function POST(req, { params }) {
  const { profile, error } = await requireGolongan(req, 5);
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
  if (task.assigned_by !== profile.id) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu bukan atasan dari task ini');
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
