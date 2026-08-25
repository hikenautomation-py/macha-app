import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { notifyTelegram } from '@/lib/telegram';
import { emailProblemReport } from '@/lib/email';
import { normalizeUrgency, URGENCY_LABEL } from '@/lib/constants';

// POST /api/tasks/{id}/problems — lapor masalah (semua user)
export async function POST(req, { params }) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { urgensi, deskripsiMasalah } = body || {};

  const u = normalizeUrgency(urgensi);
  if (!u) {
    return jsonError(400, 'INVALID_ARGUMENT', 'urgensi harus: bisa nunggu / perlu hari ini / mendesak');
  }
  if (!deskripsiMasalah || !String(deskripsiMasalah).trim()) {
    return jsonError(400, 'INVALID_ARGUMENT', 'deskripsiMasalah wajib diisi');
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

  const { data: problem, error: insErr } = await admin
    .from('task_problems')
    .insert({
      task_id: params.id,
      user_id: profile.id,
      urgency: u,
      description: deskripsiMasalah,
      status: 'open',
    })
    .select('*')
    .single();

  if (insErr) return jsonError(500, 'INTERNAL', insErr.message);

  // Notif prioritas tinggi langsung ke atasan (tidak antre approval).
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
        `🚨 <b>PROBLEM REPORT</b> — ${URGENCY_LABEL[u]}\n${task.title}\nDari: ${profile.nama}\n\n${deskripsiMasalah}`
      );
    }
    // Email notifikasi prioritas tinggi ke atasan.
    await emailProblemReport(admin, task.assigned_by, task, profile.nama, URGENCY_LABEL[u], deskripsiMasalah);
  }

  return jsonOk({ problemId: problem.id });
}
