import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { notifyTelegram } from '@/lib/telegram';
import { emailTaskApproved } from '@/lib/email';
import { getSubordinateIds, canSuperviseTask } from '@/lib/hierarchy';

// POST /api/tasks/{id}/reports/{reportId}/approve (atasan terkait, golongan >= 5)
export async function POST(req, { params }) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const admin = createAdminClient();
  const { data: task } = await admin
    .from('tasks')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!task) return jsonError(404, 'NOT_FOUND', 'Task tidak ditemukan');
  // Berhak approve bila dia yang menugaskan ATAU pelaksananya bawahannya
  // (task hasil pick-up laporan bisa punya `assigned_by` kosong).
  const subs = await getSubordinateIds(admin, profile.id);
  if (!canSuperviseTask(profile, task, subs)) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu bukan atasan dari task ini');
  }

  // Transaksi atomik di database (status + poin).
  const { data, error: rpcErr } = await admin.rpc('approve_report', {
    p_task_id: params.id,
    p_report_id: params.reportId,
    p_approved_by: profile.id,
  });

  if (rpcErr) {
    const msg = rpcErr.message || '';
    if (msg.includes('PERMISSION_DENIED')) {
      return jsonError(403, 'PERMISSION_DENIED', 'Kamu bukan atasan dari task ini');
    }
    if (msg.includes('INVALID_STATUS')) {
      return jsonError(409, 'INVALID_ARGUMENT', 'Task tidak dalam status menunggu approval');
    }
    if (msg.includes('NOT_FOUND')) {
      return jsonError(404, 'NOT_FOUND', 'Task atau report tidak ditemukan');
    }
    return jsonError(500, 'INTERNAL', msg);
  }

  const poinDitambahkan = data?.poinDitambahkan ?? 0;

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
        `🎉 <b>Disetujui!</b>\n${task.title}\n+${poinDitambahkan} poin`
      );
    }
    // Email notifikasi hasil approval ke pelaksana.
    await emailTaskApproved(admin, task.assigned_to, task, poinDitambahkan);
  }

  return jsonOk({ poinDitambahkan });
}
