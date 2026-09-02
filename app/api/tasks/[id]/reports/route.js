import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { notifyTelegram } from '@/lib/telegram';
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
  // Anti duplikat: kalau sudah ada report yang menunggu approval, tolak
  // (double-click "Kirim untuk approval" tidak membuat report kedua).
  if (task.status === 'report_submitted') {
    return jsonError(409, 'CONFLICT', 'Laporan kamu sudah masuk antrean approval — tunggu keputusan atasan');
  }
  if (['approved', 'completed'].includes(task.status)) {
    return jsonError(409, 'CONFLICT', 'Task ini sudah selesai');
  }

  // Klaim status task secara ATOMIK sebelum insert report: UPDATE berfilter
  // status != 'report_submitted' — saat double-click/paralel, hanya satu
  // request yang berhasil klaim; sisanya dapat 0 baris → 409 (anti duplikat).
  const { data: claimed, error: claimErr } = await admin
    .from('tasks')
    .update({ status: 'report_submitted' })
    .eq('id', params.id)
    .neq('status', 'report_submitted')
    .select('id');

  if (claimErr) return jsonError(500, 'INTERNAL', claimErr.message);
  if (!claimed?.length) {
    return jsonError(409, 'CONFLICT', 'Laporan kamu sudah masuk antrean approval — tunggu keputusan atasan');
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

  if (insErr) {
    // Kembalikan status task supaya user bisa coba lagi.
    await admin.from('tasks').update({ status: task.status }).eq('id', params.id);
    return jsonError(500, 'INTERNAL', insErr.message);
  }

  // Notif ke atasan terkait.
  if (task.assigned_by) {
    const { data: atasan } = await admin
      .from('users')
      .select('*')
      .eq('id', task.assigned_by)
      .maybeSingle();
    if (atasan?.telegram_chat_id) {
      await notifyTelegram(
        admin,
        atasan.telegram_chat_id,
        `✅ <b>Completion report</b>\n${task.title}\nDari: ${profile.nama}\n\nMenunggu approval kamu.`
      );
    }
    // Email notifikasi ke atasan.
    await emailReportSubmitted(admin, task.assigned_by, task, profile.nama);
  }

  return jsonOk({ reportId: report.id, statusTask: 'report_submitted' });
}
