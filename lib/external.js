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
 * Buat task dari laporan umum/request (dipakai pick up web, assign atasan,
 * dan callback 'pickup_' di Telegram). Task berstatus 'assigned', lalu klaim
 * external_requests jadi 'picked' dengan UPDATE berfilter status='open'
 * (first-come-first-served, atomik di level Postgres). `.select('id')`
 * dipakai untuk tahu berapa baris benar-benar ter-update: 0 = kalah race →
 * task dibatalkan dan kembalikan conflict supaya tidak double-assign.
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

  // Klaim laporan secara ATOMIK: UPDATE dengan filter .eq('status','open')
  // berlaku seperti row-level lock — saat dua orang pick up bersamaan, hanya
  // satu UPDATE yang akan mengubah baris ini. `.select('id')` membuat
  // PostgREST mengembalikan baris yang ter-update; 0 baris berarti kita kalah
  // race, jadi task yang barusan dibuat dibatalkan agar tidak double-assign.
  const { data: claimed, error: updErr } = await admin
    .from('external_requests')
    .update({ status: 'picked', picked_by: assignedTo, task_id: task.id })
    .eq('id', row.id)
    .eq('status', 'open')
    .select('id');

  if (updErr || !claimed?.length) {
    await admin.from('tasks').delete().eq('id', task.id);
    return {
      error: updErr || new Error('Baris external_requests tidak ter-claim (sudah diambil orang lain)'),
      conflict: true,
    };
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
