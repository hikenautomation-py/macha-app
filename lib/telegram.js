const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

/**
 * Kirim pesan ke chat Telegram. Aman dipanggil tanpa token (return null).
 * @param {string|number} chatId
 * @param {string} text  (mendukung HTML dasar: <b>, <i>, dst.)
 * @param {object} opts  tambahan: reply_markup, parse_mode, dst.
 */
export async function sendTelegramMessage(chatId, text, opts = {}) {
  if (!API_BASE || !chatId) return null;
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...opts }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

/** Jawab callback query (agar spinner tombol inline hilang). */
export async function answerCallback(callbackQueryId, text) {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

/** Edit text pesan (untuk update status tombol approval). */
export async function editMessageText(chatId, messageId, text) {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' }),
    });
    return await res.json();
  } catch {
    return null;
  }
}


/**
 * Ambil daftar chat_id group/channel notifikasi yang sudah didaftarkan.
 * Aman dipanggil tanpa tabel (return [] bila error).
 */
export async function listNotificationChannels(admin) {
  try {
    const { data } = await admin.from('notification_channels').select('chat_id');
    return (data || []).map((c) => c.chat_id);
  } catch {
    return [];
  }
}

/**
 * Kirim pesan ke satu chat individu + semua group/channel notifikasi terdaftar
 * (didedupe). Tidak throw — cocok untuk notifikasi task.
 */
export async function notifyTelegram(admin, chatId, text, opts = {}) {
  const channels = await listNotificationChannels(admin);
  const targets = new Set();
  if (chatId) targets.add(String(chatId));
  for (const c of channels) targets.add(String(c));
  for (const t of targets) {
    await sendTelegramMessage(t, text, opts);
  }
}

