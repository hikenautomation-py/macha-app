import { createAdminClient } from '@/lib/supabase';
import { jsonOk, jsonError } from '@/lib/auth';
import { sendTelegramMessage, answerCallback, editMessageText } from '@/lib/telegram';
import { normalizeUrgency, URGENCY_LABEL, golonganLabel } from '@/lib/constants';

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

  // 3) Langkah registrasi berjalan (state machine per chat_id)
  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .eq('chat_id', String(chatId))
    .maybeSingle();

  if (pending && ['step_nama', 'step_nik', 'step_golongan'].includes(pending.status)) {
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
      `Halo, <b>${user.nama}</b> 👋\nAkun kamu sudah aktif sebagai <b>${golonganLabel(user.golongan)}</b> (golongan ${user.golongan}).\n\nTask akan muncul otomatis di sini. Semangat!`
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

  // Mulai alur registrasi.
  await admin.from('pending_registrations').upsert({
    chat_id: String(chatId),
    nama: '',
    nik: '',
    golongan: 0,
    status: 'step_nama',
  });

  await sendTelegramMessage(chatId, 'Yuk mulai, kenalan dulu! 😊\n\nSiapa nama lengkap kamu?');
}

// ---------- Langkah registrasi ----------
async function handleRegistrationStep(admin, pending, chatId, text) {
  if (!text) {
    await sendTelegramMessage(chatId, 'Kirim jawaban berupa teks ya.');
    return;
  }

  if (pending.status === 'step_nama') {
    await admin.from('pending_registrations').update({ nama: text, status: 'step_nik' }).eq('chat_id', String(chatId));
    await sendTelegramMessage(chatId, `Halo, ${text}! 👋\nBerapa NIK karyawan kamu?`);
    return;
  }

  if (pending.status === 'step_nik') {
    await admin.from('pending_registrations').update({ nik: text, status: 'step_golongan' }).eq('chat_id', String(chatId));
    await sendTelegramMessage(chatId, 'Terakhir, golongan berapa kamu? (angka 1-7)\nContoh: <code>3</code> untuk technician.');
    return;
  }

  if (pending.status === 'step_golongan') {
    const g = parseInt(text, 10);
    if (Number.isNaN(g) || g < 1 || g > 7) {
      await sendTelegramMessage(chatId, 'Masukkan golongan berupa angka 1-7 ya.');
      return;
    }
    await admin.from('pending_registrations').update({ golongan: g, status: 'pending' }).eq('chat_id', String(chatId));

    await sendTelegramMessage(chatId, 'Mantap! 🎉 Data kamu sudah masuk, tinggal nunggu admin approve. Nanti aku kabari kalau sudah aktif.');

    // Notifikasi ke admin dengan tombol inline.
    if (ADMIN_CHAT_ID) {
      await sendTelegramMessage(ADMIN_CHAT_ID, `📥 <b>Registrasi baru</b>\nNama: ${pending.nama}\nNIK: ${pending.nik}\nGolongan: ${g}`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Setujui', callback_data: `approve_${chatId}` },
            { text: '❌ Tolak', callback_data: `reject_${chatId}` },
          ]],
        },
      });
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
      nik: pending.nik,
      golongan: pending.golongan,
      telegram_chat_id: String(chatId),
    })
    .select('id')
    .single();

  if (error) {
    await sendTelegramMessage(cq.message?.chat?.id, `Gagal approve: ${error.message}`);
    return;
  }

  await admin.from('pending_registrations').delete().eq('chat_id', String(chatId));
  await sendTelegramMessage(chatId, `🎉 Selamat, ${pending.nama}! Akun kamu sudah aktif. Ketik /start untuk mulai.`);

  if (messageId) {
    await editMessageText(cq.message?.chat?.id, messageId, `✅ <b>${pending.nama}</b> (NIK ${pending.nik}) sudah disetujui.`);
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
        await sendTelegramMessage(atasan.telegram_chat_id, `✅ <b>Completion report</b> (via bot)\n${task.title}\n\nMenunggu approval.`);
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
      await sendTelegramMessage(atasan.telegram_chat_id, `🚨 <b>PROBLEM REPORT</b> — ${URGENCY_LABEL[urgensi]}\n${task.title}\n\n${deskripsi}`);
    }
  }
}
