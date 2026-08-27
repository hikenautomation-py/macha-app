import { sendTelegramMessage, notifyTelegram } from './telegram';

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
