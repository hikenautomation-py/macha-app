import { createAdminClient } from '@/lib/supabase';
import { jsonOk, jsonError } from '@/lib/auth';
import { sendTelegramMessage, answerCallback, editMessageText, notifyTelegram } from '@/lib/telegram';
import { emailRegistrationApproved } from '@/lib/email';
import { normalizeUrgency, URGENCY_LABEL, isAtasan, userTitle, TITLE_OPTIONS, WEB_APP_URL } from '@/lib/constants';

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const TASK_ID_RE = /#task_([0-9a-fA-F-]{36})/;

// POST /api/telegramWebhook — endpoint tunggal penerima update Telegram.
// Divalidasi lewat secret token webhook Telegram (bukan Supabase JWT).
export async function POST(req) {
  // Validasi secret token webhook Telegram.
  // Telegram mengirim token ini di header `X-Telegram-Bot-Api-Secret-Token`.
  // Bila TELEGRAM_WEBHOOK_SECRET diisi, update tanpa token yang cocok ditolak.
  if (WEBHOOK_SECRET) {
    const secret = req.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== WEBHOOK_SECRET) {
      return jsonError(401, 'UNAUTHORIZED', 'Secret token Telegram tidak valid');
    }
  }

  const update = await req.json().catch(() => null);
  if (!update) return jsonOk({ received: false });

  const admin = createAdminClient();

  // 1) Callback query (tombol inline approve/reject)
  if (update.callback_query) {
    await handleCallback(admin, update.callback_query);
    return jsonOk({ received: true });
  }

  const msg = update.message;
  if (!msg) return jsonOk({ received: true });

  const chatId = msg.chat.id;
  const text = (msg.text || msg.caption || '').trim();

  // 2) /start
  if (text === '/start') {
    await handleStart(admin, chatId);
    return jsonOk({ received: true });
  }

  // 2b) Daftarkan / hapus group/channel penerima broadcast notifikasi.
  if (text.startsWith('/daftargrup')) {
    await handleRegisterChannel(admin, msg, chatId);
    return jsonOk({ received: true });
  }
  if (text.startsWith('/hapusgrup')) {
    await handleRemoveChannel(admin, msg, chatId);
    return jsonOk({ received: true });
  }

  // 3) Langkah registrasi berjalan (state machine per chat_id)
  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .eq('chat_id', String(chatId))
    .maybeSingle();

  if (pending && ['step_npk', 'step_nama', 'step_golongan', 'step_title', 'step_email'].includes(pending.status)) {
    await handleRegistrationStep(admin, pending, chatId, text);
    return jsonOk({ received: true });
  }

  // 4) Balasan ke notifikasi task (completion/problem report via bot)
  if (msg.reply_to_message) {
    await handleTaskReply(admin, msg, chatId, text);
    return jsonOk({ received: true });
  }

  await sendTelegramMessage(chatId, 'Hmm, aku belum paham pesan itu. Ketik /start untuk mulai ya.');
  return jsonOk({ received: true });
}

// ---------- Callback approve/reject ----------
async function handleCallback(admin, cq) {
  const data = cq.data || '';
  const messageId = cq.message?.message_id;

  if (data.startsWith('approve_')) {
    const chatId = data.slice('approve_'.length);
    await answerCallback(cq.id, 'Disetujui ✅');
    await approveRegistration(admin, chatId, cq, messageId);
  } else if (data.startsWith('reject_')) {
    const chatId = data.slice('reject_'.length);
    await answerCallback(cq.id, 'Ditolak ❌');
    await rejectRegistration(admin, chatId, cq, messageId);
  } else {
    await answerCallback(cq.id, '');
  }
}

// ---------- Alur /start ----------
async function handleStart(admin, chatId) {
  const { data: user } = await admin
    .from('users')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .maybeSingle();

  if (user) {
    await sendTelegramMessage(
      chatId,
      `Halo, <b>${user.nama}</b> 👋\nAkun kamu sudah aktif sebagai <b>${userTitle(user)}</b> (golongan ${user.golongan}).\n\nTask akan muncul otomatis di sini. Semangat!`
    );
    return;
  }

  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .eq('chat_id', String(chatId))
    .maybeSingle();

  if (pending && pending.status === 'pending') {
    await sendTelegramMessage(chatId, 'Registrasi kamu masih menunggu approval admin ya. Santai, biasanya cuma beberapa menit.');
    return;
  }

  // Mulai alur registrasi: NPK dulu untuk dicocokkan dengan akun web.
  await admin.from('pending_registrations').upsert({
    chat_id: String(chatId),
    nama: '',
    npk: '',
    golongan: 0,
    title: '',
    email: '',
    status: 'step_npk',
  });

  await sendTelegramMessage(
    chatId,
    'Halo! Sebelum daftar, masukkan <b>NPK</b> karyawan kamu dulu ya. 😊\n\n' +
      'NPK dipakai untuk mencocokkan akun web — kalau sudah terdaftar di app, akun Telegram kamu langsung tertaut.'
  );
}

// Resolve input title dari angka (1-6) atau nama title (case-insensitive).
function resolveTitle(text) {
  const idx = parseInt(text, 10);
  if (!Number.isNaN(idx) && idx >= 1 && idx <= TITLE_OPTIONS.length) {
    return TITLE_OPTIONS[idx - 1];
  }
  const t = TITLE_OPTIONS.find((x) => x.toLowerCase() === String(text || '').trim().toLowerCase());
  return t || null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tautkan chat Telegram ke akun web yang sudah terdaftar (via NPK).
async function linkUserByNpk(admin, chatId, npk) {
  const { data: user } = await admin.from('users').select('*').eq('npk', npk).maybeSingle();
  if (!user) return null;

  if (user.telegram_chat_id === String(chatId)) {
    await sendTelegramMessage(
      chatId,
      `✅ NPK <b>${npk}</b> sudah tertaut dengan chat Telegram ini (akun <b>${user.nama}</b>). Ketik /start untuk mulai.`
    );
    return user;
  }

  // Lepas tautan chat ini dari user lain dulu (kolom telegram_chat_id unique),
  // lalu set ke akun yang cocok — link terbaru yang menang.
  await admin.from('users').update({ telegram_chat_id: null }).eq('telegram_chat_id', String(chatId));
  await admin.from('users').update({ telegram_chat_id: String(chatId) }).eq('id', user.id);
  await admin.from('pending_registrations').delete().eq('chat_id', String(chatId));

  await sendTelegramMessage(
    chatId,
    `🎉 NPK <b>${npk}</b> cocok dengan akun web <b>${user.nama}</b> (${userTitle(user)}, golongan ${user.golongan}).\n\n` +
      'Akun Telegram kamu sekarang <b>tertaut</b> dengan akun web — notifikasi task akan masuk ke sini.\nKetik /start untuk mulai.'
  );
  return user;
}


// ---------- Langkah registrasi ----------
async function handleRegistrationStep(admin, pending, chatId, text) {
  if (!text) {
    await sendTelegramMessage(chatId, 'Kirim jawaban berupa teks ya.');
    return;
  }

  if (pending.status === 'step_npk') {
    const npk = text.trim();
    if (!npk) {
      await sendTelegramMessage(chatId, 'NPK tidak boleh kosong. Masukkan NPK kamu ya.');
      return;
    }

    // 1) Cocokkan NPK dengan akun web yang sudah terdaftar.
    const linked = await linkUserByNpk(admin, chatId, npk);
    if (linked) return;

    // 2) Cek apakah NPK sedang menunggu approval dari chat lain.
    const { data: other } = await admin
      .from('pending_registrations')
      .select('chat_id')
      .eq('npk', npk)
      .neq('chat_id', String(chatId))
      .maybeSingle();
    if (other) {
      await sendTelegramMessage(chatId, 'NPK ini sedang dalam proses registrasi dari chat Telegram lain. Tunggu approval admin ya, atau hubungi admin kalau ada kendala.');
      return;
    }

    // 3) Belum terdaftar → lanjut isi data pendaftaran.
    await admin.from('pending_registrations').update({ npk, status: 'step_nama' }).eq('chat_id', String(chatId));
    await sendTelegramMessage(chatId, `NPK <b>${npk}</b> belum terdaftar di web. Lanjut registrasi lewat Telegram ya! 😊\n\nSiapa nama lengkap kamu?`);
    return;
  }

  if (pending.status === 'step_nama') {
    await admin.from('pending_registrations').update({ nama: text, status: 'step_golongan' }).eq('chat_id', String(chatId));
    await sendTelegramMessage(chatId, `Halo, ${text}! 👋\nGolongan berapa kamu? (angka 1-7)\nContoh: <code>3</code> untuk technician.`);
    return;
  }

  if (pending.status === 'step_golongan') {
    const g = parseInt(text, 10);
    if (Number.isNaN(g) || g < 1 || g > 7) {
      await sendTelegramMessage(chatId, 'Masukkan golongan berupa angka 1-7 ya.');
      return;
    }
    await admin.from('pending_registrations').update({ golongan: g, status: 'step_title' }).eq('chat_id', String(chatId));

    await sendTelegramMessage(
      chatId,
      'Selanjutnya, apa title/jabatan kamu?\n' +
        TITLE_OPTIONS.map((t, i) => `${i + 1}. ${t}`).join('\n') +
        '\n\nKirim angkanya (contoh: <code>4</code> untuk SPV).'
    );
    return;
  }

  if (pending.status === 'step_title') {
    const title = resolveTitle(text);
    if (!title) {
      await sendTelegramMessage(
        chatId,
        'Pilih title dengan angka ya:\n' + TITLE_OPTIONS.map((t, i) => `${i + 1}. ${t}`).join('\n')
      );
      return;
    }
    await admin.from('pending_registrations').update({ title, status: 'step_email' }).eq('chat_id', String(chatId));

    await sendTelegramMessage(
      chatId,
      'Terakhir, masukkan <b>email</b> kamu. 📧\n\n' +
        '⚠️ <b>Penting:</b> email ini juga dipakai untuk <b>notifikasi</b> (task baru, hasil approval, dll). ' +
        'Prioritaskan pakai <b>email kantor</b> ya (contoh: nama@perusahaan.com).'
    );
    return;
  }

  if (pending.status === 'step_email') {
    const email = text.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      await sendTelegramMessage(chatId, 'Format email belum benar. Contoh: <code>nama@perusahaan.com</code>');
      return;
    }
    await admin.from('pending_registrations').update({ email, status: 'pending' }).eq('chat_id', String(chatId));

    await sendTelegramMessage(
      chatId,
      `🎉 Registrasi kamu sudah lengkap dan menunggu <b>approval admin</b> — biasanya cuma beberapa menit.\n\n` +
        `💻 Saran: kamu juga bisa login / pantau status di web app: <a href="${WEB_APP_URL}">app.machapp.web.id</a>\n` +
        'Nanti aku kabari kalau akun sudah aktif.'
    );

    // Notifikasi ke admin dengan tombol inline.
    if (ADMIN_CHAT_ID) {
      await sendTelegramMessage(
        ADMIN_CHAT_ID,
        `📥 <b>Registrasi baru</b>\nNama: ${pending.nama}\nNPK: ${pending.npk}\nGolongan: ${pending.golongan}\nTitle: ${pending.title}\nEmail: ${email}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Setujui', callback_data: `approve_${chatId}` },
              { text: '❌ Tolak', callback_data: `reject_${chatId}` },
            ]],
          },
        }
      );
    }
  }
}

// ---------- Approval ----------
async function approveRegistration(admin, chatId, cq, messageId) {
  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .eq('chat_id', String(chatId))
    .maybeSingle();

  if (!pending) {
    await sendTelegramMessage(cq.message?.chat?.id, 'Registrasi ini sudah tidak ada.');
    return;
  }

  const { data: user, error } = await admin
    .from('users')
    .insert({
      nama: pending.nama,
      npk: pending.npk,
      golongan: pending.golongan,
      title: pending.title,
      email: pending.email || null,
      telegram_chat_id: String(chatId),
    })
    .select('id')
    .single();

  if (error) {
    await sendTelegramMessage(cq.message?.chat?.id, `Gagal approve: ${error.message}`);
    return;
  }

  await admin.from('pending_registrations').delete().eq('chat_id', String(chatId));
  if (pending.email) {
    await emailRegistrationApproved(pending.email, { nama: pending.nama, npk: pending.npk });
  }
  await sendTelegramMessage(chatId, `🎉 Selamat, ${pending.nama}! Akun kamu sudah aktif. Ketik /start untuk mulai.`);

  if (messageId) {
    await editMessageText(cq.message?.chat?.id, messageId, `✅ <b>${pending.nama}</b> (NPK ${pending.npk}) sudah disetujui.`);
  }
}

async function rejectRegistration(admin, chatId, cq, messageId) {
  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .eq('chat_id', String(chatId))
    .maybeSingle();

  await admin.from('pending_registrations').delete().eq('chat_id', String(chatId));
  await sendTelegramMessage(chatId, 'Maaf, registrasi kamu ditolak admin. Kalau ada salah data, ketik /start untuk coba lagi ya.');

  if (messageId) {
    await editMessageText(cq.message?.chat?.id, messageId, `❌ <b>${pending?.nama || 'User'}</b> ditolak.`);
  }
}

// ---------- Daftar / hapus group/channel notifikasi ----------
async function handleRegisterChannel(admin, msg, chatId) {
  const chatType = msg.chat?.type;
  if (!['group', 'supergroup', 'channel'].includes(chatType)) {
    await sendTelegramMessage(chatId, 'Perintah ini dijalankan di dalam group/channel ya, bukan di chat pribadi.');
    return;
  }

  const senderId = String(msg.from?.id || '');
  const isAdminChat = senderId === String(ADMIN_CHAT_ID);
  const { data: sender } = await admin
    .from('users')
    .select('*')
    .eq('telegram_chat_id', senderId)
    .maybeSingle();
  const isAdminUser = sender && isAtasan(sender);

  if (!isAdminChat && !isAdminUser) {
    await sendTelegramMessage(chatId, 'Maaf, hanya admin yang bisa mendaftarkan group/channel.');
    return;
  }

  const nama = msg.chat?.title || msg.chat?.username || String(chatId);
  const { error } = await admin.from('notification_channels').upsert(
    { chat_id: String(chatId), nama, chat_type: chatType },
    { onConflict: 'chat_id' }
  );

  if (error) {
    await sendTelegramMessage(chatId, `Gagal mendaftarkan group/channel: ${error.message}`);
    return;
  }

  await sendTelegramMessage(
    chatId,
    `✅ Group/channel ini sudah didaftarkan sebagai penerima notifikasi.\nSemua notifikasi task (task baru, completion report, problem report, hasil approval) akan diteruskan ke sini.\n\nchat_id: <code>${chatId}</code>`
  );
}

async function handleRemoveChannel(admin, msg, chatId) {
  const chatType = msg.chat?.type;
  if (!['group', 'supergroup', 'channel'].includes(chatType)) {
    await sendTelegramMessage(chatId, 'Perintah ini dijalankan di dalam group/channel ya, bukan di chat pribadi.');
    return;
  }

  const senderId = String(msg.from?.id || '');
  const isAdminChat = senderId === String(ADMIN_CHAT_ID);
  const { data: sender } = await admin
    .from('users')
    .select('*')
    .eq('telegram_chat_id', senderId)
    .maybeSingle();
  const isAdminUser = sender && isAtasan(sender);

  if (!isAdminChat && !isAdminUser) {
    await sendTelegramMessage(chatId, 'Maaf, hanya admin yang bisa menghapus group/channel.');
    return;
  }

  await admin.from('notification_channels').delete().eq('chat_id', String(chatId));
  await sendTelegramMessage(chatId, '🗑️ Group/channel ini sudah dihapus dari daftar penerima notifikasi.');
}

// ---------- Balasan ke notifikasi task ----------
async function handleTaskReply(admin, msg, chatId, text) {
  const repliedText = msg.reply_to_message?.text || '';
  const match = repliedText.match(TASK_ID_RE);
  if (!match) {
    await sendTelegramMessage(chatId, 'Balasan ini tidak terkait task tertentu.');
    return;
  }
  const taskId = match[1];

  const { data: task } = await admin.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) {
    await sendTelegramMessage(chatId, 'Task tidak ditemukan.');
    return;
  }

  const { data: user } = await admin
    .from('users')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .maybeSingle();

  const userId = user?.id || task.assigned_to;

  // Heuristic: ada foto → completion report; teks saja → problem report.
  if (msg.photo && msg.photo.length > 0) {
    const catatan = text || 'Selesai dikerjakan via bot.';
    await admin.from('task_reports').insert({
      task_id: taskId,
      user_id: userId,
      progress_note: catatan,
      photo_url: null,
      status: 'report_submitted',
    });
    await admin.from('tasks').update({ status: 'report_submitted' }).eq('id', taskId);
    await sendTelegramMessage(chatId, '✅ Laporan selesai terkirim. Menunggu approval atasan ya.');
    if (task.assigned_by) {
      const { data: atasan } = await admin.from('users').select('telegram_chat_id').eq('id', task.assigned_by).maybeSingle();
      if (atasan?.telegram_chat_id) {
        await notifyTelegram(admin, atasan.telegram_chat_id, `✅ <b>Completion report</b> (via bot)\n${task.title}\n\nMenunggu approval.`);
      }
    }
    return;
  }

  if (!text) return;
  const firstWord = text.split(/\s+/)[0].toLowerCase();
  const isUrgensi = !!normalizeUrgency(firstWord);
  const urgensi = normalizeUrgency(firstWord) || 'perlu_hari_ini';
  const deskripsi = isUrgensi ? text.split(/\s+/).slice(1).join(' ') : text;

  await admin.from('task_problems').insert({
    task_id: taskId,
    user_id: userId,
    urgency: urgensi,
    description: deskripsi,
    status: 'open',
  });

  await sendTelegramMessage(chatId, `🚨 Problem report terkirim (${URGENCY_LABEL[urgensi]}). Atasan akan segera menindaklanjuti.`);
  if (task.assigned_by) {
    const { data: atasan } = await admin.from('users').select('telegram_chat_id').eq('id', task.assigned_by).maybeSingle();
    if (atasan?.telegram_chat_id) {
      await notifyTelegram(admin, atasan.telegram_chat_id, `🚨 <b>PROBLEM REPORT</b> — ${URGENCY_LABEL[urgensi]}\n${task.title}\n\n${deskripsi}`);
    }
  }
}
