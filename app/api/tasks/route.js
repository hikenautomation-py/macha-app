import { requireAtasan, requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { mapTask } from '@/lib/mappers';
import { notifyTelegram } from '@/lib/telegram';
import { emailTaskAssigned } from '@/lib/email';

// POST /api/tasks — buat task baru (golongan >= 5)
export async function POST(req) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { judul, deskripsi, ditugaskanKe, bobotPoin, deadline } = body || {};

  if (!judul || !ditugaskanKe) {
    return jsonError(400, 'INVALID_ARGUMENT', 'judul dan ditugaskanKe wajib diisi');
  }

  const admin = createAdminClient();
  const { data: task, error: insErr } = await admin
    .from('tasks')
    .insert({
      assigned_by: profile.id,
      assigned_to: ditugaskanKe,
      title: judul,
      description: deskripsi || null,
      points: Number(bobotPoin) || 0,
      deadline: deadline || null,
      status: 'assigned',
    })
    .select('*')
    .single();

  if (insErr) return jsonError(500, 'INTERNAL', insErr.message);

  // Notifikasi Telegram (+ email opsional) ke user yang ditugaskan.
  const { data: target } = await admin
    .from('users')
    .select('*')
    .eq('id', ditugaskanKe)
    .maybeSingle();

  if (target?.telegram_chat_id) {
    const poin = Number(bobotPoin) || 0;
    await notifyTelegram(
      admin,
      target.telegram_chat_id,
      `📋 <b>Task baru</b>\n${judul}${deadline ? `\nDeadline: ${deadline}` : ''}\nBobot: ${poin} poin\n\n🔖 #task_${task.id}`
    );
  }

  // Email notifikasi task baru ke pelaksana.
  await emailTaskAssigned(admin, ditugaskanKe, task);

  return jsonOk({ taskId: task.id, status: task.status });
}

// GET /api/tasks?userId=&status= — daftar task (semua user)
export async function GET(req) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const status = url.searchParams.get('status');

  const admin = createAdminClient();
  let q = admin.from('tasks').select('*').order('created_at', { ascending: false });
  if (userId) q = q.eq('assigned_to', userId);
  if (status) q = q.eq('status', status);

  const { data, error: err } = await q;
  if (err) return jsonError(500, 'INTERNAL', err.message);

  return jsonOk((data || []).map(mapTask));
}
