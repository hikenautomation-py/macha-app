import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram';
import { emailReportSubmitted } from '@/lib/email';

// POST /api/tasks/{id}/reports — submit laporan penyelesaian (semua user)
export async function POST(req, { params }) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { catatan, lampiranUrl } = body || {};

  if (!catatan || !String(catatan).trim()) {
    return jsonError(400, 'INVALID_ARGUMENT', 'catatan wajib diisi');
  }

  const admin = createAdminClient();
  const { data: task } = await admin
    .from('tasks')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!task) return jsonError(404, 'NOT_FOUND', 'Task tidak ditemukan');
  if (task.assigned_to !== profile.id) {
    return jsonError(403, 'PERMISSION_DENIED', 'Task ini bukan milik kamu');
  }

  const { data: report, error: insErr } = await admin
    .from('task_reports')
    .insert({
      task_id: params.id,
      user_id: profile.id,
      progress_note: catatan,
      photo_url: lampiranUrl || null,
      status: 'report_submitted',
    })
    .select('*')
    .single();

  if (insErr) return jsonError(500, 'INTERNAL', insErr.message);

  // Ubah status task menjadi report_submitted.
  await admin.from('tasks').update({ status: 'report_submitted' }).eq('id', params.id);

  // Notif ke atasan terkait.
  if (task.assigned_by) {
    const { data: atasan } = await admin
      .from('users')
      .select('*')
      .eq('id', task.assigned_by)
      .maybeSingle();
    if (atasan?.telegram_chat_id) {
      await sendTelegramMessage(
        atasan.telegram_chat_id,
        `✅ <b>Completion report</b>\n${task.title}\nDari: ${profile.nama}\n\nMenunggu approval kamu.`
      );
    }
    // Email notifikasi ke atasan.
    await emailReportSubmitted(admin, task.assigned_by, task, profile.nama);
  }

  return jsonOk({ reportId: report.id, statusTask: 'report_submitted' });
}
