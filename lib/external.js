import { sendTelegramMessage, notifyTelegram } from './telegram';
import { emailTaskAssigned } from './email';

export const EXTERNAL_TYPE_LABEL = {
  problem: '🚨 LAPORAN MASALAH',
  improvement: '💡 PERMINTAAN IMPROVEMENT',
};

export const EXTERNAL_TYPE_TITLE = {
  problem: 'Laporan masalah umum',
  improvement: 'Permintaan improvement',
};

/** Teks notifikasi sebuah laporan/request, tanpa tombol. */
export function externalRequestText(row) {
  const label = EXTERNAL_TYPE_LABEL[row.type] || 'LAPORAN';
  return `${label}\nDari: ${row.nama}${row.npk ? ` (NPK ${row.npk})` : ''}\n\n${row.description}`;
}

/** Keyboard inline Pick up / Reject untuk laporan yang masih open. */
export function externalRequestKeyboard(row) {
  return {
    inline_keyboard: [[
      { text: '🙋 Pick up', callback_data: `pickup_${row.id}` },
      { text: '❌ Reject', callback_data: `xreject_${row.id}` },
    ]],
  };
}

/** Kirim notifikasi laporan/request (ke admin + semua channel) dengan tombol aksi. */
export async function broadcastExternalRequest(admin, row) {
  const opts = { reply_markup: externalRequestKeyboard(row) };
  const text = externalRequestText(row);
  if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
    await sendTelegramMessage(process.env.TELEGRAM_ADMIN_CHAT_ID, text, opts);
  }
  await notifyTelegram(admin, null, text, opts);
}

/**
 * Buat task dari laporan umum/request (dipakai pick up web & assign atasan).
 * Meniru flow pickup Telegram: task berstatus 'assigned', lalu update
 * external_requests jadi 'picked' dengan guard .eq('status','open')
 * (first-come-first-served) supaya tidak double-assign.
 */
export async function createTaskFromExternal(admin, { row, assignedBy, assignedTo }) {
  const { data: task, error: taskErr } = await admin
    .from('tasks')
    .insert({
      assigned_by: assignedBy,
      assigned_to: assignedTo,
      title: `[${row.type === 'problem' ? 'Laporan' : 'Request'}] ${row.description.slice(0, 80)}`,
      description: `Laporan dari ${row.nama}${row.npk ? ` (NPK ${row.npk})` : ''}.\n\n${row.description}`,
      points: 0,
      deadline: null,
      status: 'assigned',
    })
    .select('*')
    .single();

  if (taskErr) return { error: taskErr };

  const { error: updErr } = await admin
    .from('external_requests')
    .update({ status: 'picked', picked_by: assignedTo, task_id: task.id })
    .eq('id', row.id)
    .eq('status', 'open');

  if (updErr) {
    await admin.from('tasks').delete().eq('id', task.id);
    return { error: updErr, conflict: true };
  }

  const { data: target } = await admin
    .from('users')
    .select('*')
    .eq('id', assignedTo)
    .maybeSingle();

  if (target?.telegram_chat_id) {
    await sendTelegramMessage(
      target.telegram_chat_id,
      `📋 <b>Task baru dari ${row.type === 'problem' ? 'laporan' : 'request'}</b>\n${task.title}\n\nKamu yang menangani laporan/request ini. Selesaikan dan lapor seperti task biasa.\n\n🔖 #task_${task.id}`
    );
  }

  await emailTaskAssigned(admin, assignedTo, task);

  return { task };
}
