import { requireAtasan, requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { mapTask } from '@/lib/mappers';
import { sendTelegramMessage, notifyTelegram } from '@/lib/telegram';
import { emailTaskAssigned } from '@/lib/email';
import { isAtasan } from '@/lib/constants';
import { getSubordinateIds } from '@/lib/hierarchy';

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

  // Atasan hanya boleh menugaskan ke bawahannya (subtree atasan_id).
  const subs = await getSubordinateIds(admin, profile.id);
  if (!subs.includes(ditugaskanKe)) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu hanya bisa menugaskan task ke bawahan kamu');
  }
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
    const text = `📋 <b>Task baru</b>\n${judul}${deadline ? `\nDeadline: ${deadline}` : ''}\nBobot: ${poin} poin\n\n🔖 #task_${task.id}`;

    // Chat pribadi pelaksana: sertakan tombol aksi cepat.
    await sendTelegramMessage(target.telegram_chat_id, text, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🚨 Lapor', callback_data: `report_${task.id}` },
          { text: '📝 Update', callback_data: `update_${task.id}` },
          { text: '✅ Selesai', callback_data: `complete_${task.id}` },
        ]],
      },
    });

    // Broadcast ke group/channel terdaftar: tanpa tombol (biar tak tertekan asal).
    await notifyTelegram(admin, null, text);
  }

  // Email notifikasi task baru ke pelaksana.
  await emailTaskAssigned(admin, ditugaskanKe, task);

  return jsonOk({ taskId: task.id, status: task.status });
}

// GET /api/tasks?userId=&status= — daftar task (semua user)
// Non-atasan hanya boleh lihat task miliknya; atasan boleh lihat subtree bawahan.
export async function GET(req) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const status = url.searchParams.get('status');

  const admin = createAdminClient();

  if (userId) {
    const viewable = isAtasan(profile)
      ? [profile.id, ...(await getSubordinateIds(admin, profile.id))]
      : [profile.id];
    if (!viewable.includes(userId)) {
      return jsonError(403, 'PERMISSION_DENIED', 'Kamu tidak punya akses ke task user ini');
    }
  }

  let q = admin.from('tasks').select('*').order('created_at', { ascending: false });
  if (userId) {
    q = q.eq('assigned_to', userId);
  } else if (!isAtasan(profile)) {
    q = q.eq('assigned_to', profile.id);
  }
  if (status) q = q.eq('status', status);

  const { data, error: err } = await q;
  if (err) return jsonError(500, 'INTERNAL', err.message);

  return jsonOk((data || []).map(mapTask));
}
