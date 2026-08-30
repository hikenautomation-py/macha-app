import { createAdminClient } from '@/lib/supabase';
import { jsonOk, jsonError } from '@/lib/auth';
import { sendTelegramMessage, answerCallback, editMessageText, notifyTelegram, setBotCommands } from '@/lib/telegram';
import { emailRegistrationApproved, emailExternalReport, emailTaskAssigned } from '@/lib/email';
import { normalizeUrgency, URGENCY_LABEL, isAtasan, userTitle, TITLE_OPTIONS, WEB_APP_URL, ATASAN_TITLES, golonganLabel } from '@/lib/constants';
import { externalRequestText, broadcastExternalRequest } from '@/lib/external';

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

  // Segarkan menu perintah bot (muncul saat user ketik "/") agar selalu sinkron
  // setelah kode di-deploy. Persisten di sisi Telegram.
  if (text.startsWith('/')) await setBotCommands();

  // 2) /start
  if (text === '/start') {
    await handleStart(admin, chatId);
    return jsonOk({ received: true });
  }

  // 2a) /help — daftar perintah bot.
  if (text === '/help') {
    await handleHelp(chatId);
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
  if (text === '/laporan' || text === '/request') {
    await handleStartExternalReport(admin, msg, chatId, text === '/request' ? 'improvement' : 'problem');
    return jsonOk({ received: true });
  }

  // 2c) Teks lanjutan dari aksi tombol task (Lapor / Update / Selesai).
  if (await handleTaskContextInput(admin, msg, chatId, text)) {
    return jsonOk({ received: true });
  }

  // 2d) Teks lanjutan dari /laporan atau /request (nama → NPK → deskripsi).
  if (await handleExternalReportInput(admin, msg, chatId, text)) {
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

  await sendTelegramMessage(chatId, 'Hmm, aku belum paham pesan itu. Ketik /help untuk lihat perintah yang tersedia, atau /start untuk mulai.');
  return jsonOk({ received: true });
}

// ---------- Callback approve/reject & aksi task ----------
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
  } else if (data.startsWith('report_')) {
    await startTaskAction(admin, cq, data.slice('report_'.length), 'lapor');
  } else if (data.startsWith('update_')) {
    await startTaskAction(admin, cq, data.slice('update_'.length), 'update');
  } else if (data.startsWith('complete_')) {
    await startTaskAction(admin, cq, data.slice('complete_'.length), 'selesai');
  } else if (data.startsWith('pickup_')) {
    await handleExternalPickup(admin, cq, data.slice('pickup_'.length), messageId);
  } else if (data.startsWith('xreject_')) {
    await handleExternalReject(admin, cq, data.slice('xreject_'.length), messageId);
  } else {
    await answerCallback(cq.id, '');
  }
}

// ---------- Aksi tombol task baru (Lapor / Update / Selesai) ----------
// Tombol inline tidak bisa memunculkan input teks, jadi setelah tombol ditekan
// kita simpan konteks aksi di tabel telegram_convos lalu minta user mengirim
// teks/foto berikutnya (diproses oleh handleTaskContextInput).
const TASK_ACTION_PROMPT = {
  lapor:
    '🚨 Oke, ceritakan <b>masalah</b>-nya. Boleh awali dengan tingkat urgensi: ' +
    '<code>mendesak</code>, <code>perlu hari ini</code>, atau <code>bisa nunggu</code>.\n\nContoh: <i>mendesak Line 2 downtime</i>',
  update:
    '📝 Update progress? Kirim catatan singkatnya ya.\nContoh: <i>Sudah ganti bearing, tinggal kalibrasi</i>',
  selesai:
    '✅ Nice! Kirim <b>catatan penyelesaian</b>-nya ya (boleh sertakan foto).\nContoh: <i>Sudah dites jalan normal</i>',
};

async function startTaskAction(admin, cq, taskId, action) {
  const chatId = cq.message?.chat?.id;
  const fromId = String(cq.from?.id || '');

  const { data: task } = await admin.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) {
    await answerCallback(cq.id, 'Task tidak ditemukan');
    return;
  }

  // Hanya pelaksana task (atau admin) yang boleh menjalankan aksi.
  const { data: actor } = await admin.from('users').select('id').eq('telegram_chat_id', fromId).maybeSingle();
  const isOwner = actor?.id === task.assigned_to;
  const isAdminActor = actor && isAtasan(actor);
  if (!isOwner && !isAdminActor) {
    await answerCallback(cq.id, 'Kamu bukan pelaksana task ini');
    return;
  }

  await admin
    .from('telegram_convos')
    .upsert({ chat_id: String(chatId), task_id: taskId, action }, { onConflict: 'chat_id' });

  await answerCallback(cq.id, '');
  await sendTelegramMessage(chatId, TASK_ACTION_PROMPT[action] || '');
}

// Proses pesan lanjutan setelah tombol task ditekan. return true bila terpakai.
async function handleTaskContextInput(admin, msg, chatId, text) {
  const { data: ctx } = await admin
    .from('telegram_convos')
    .select('*')
    .eq('chat_id', String(chatId))
    .maybeSingle();
  if (!ctx) return false;

  const taskId = ctx.task_id;
  const { data: task } = await admin.from('tasks').select('*').eq('id', taskId).maybeSingle();

  // hapus konteks apapun hasil akhirnya (hindari penumpukan state)
  await admin.from('telegram_convos').delete().eq('chat_id', String(chatId));

  if (!task) {
    await sendTelegramMessage(chatId, 'Task sudah tidak ada.');
    return true;
  }

  if (ctx.action === 'lapor') {
    const deskripsi = text?.trim() || 'Dilaporkan via bot tanpa keterangan.';
    const firstWord = deskripsi.split(/\s+/)[0].toLowerCase();
    const urgensi = normalizeUrgency(firstWord) || 'perlu_hari_ini';
    const isUrgensi = !!normalizeUrgency(firstWord);

    await admin.from('task_problems').insert({
      task_id: taskId,
      user_id: task.assigned_to,
      urgency: urgensi,
      description: isUrgensi ? deskripsi.split(/\s+/).slice(1).join(' ') : deskripsi,
      status: 'open',
    });

    await sendTelegramMessage(chatId, `🚨 Problem report terkirim (${URGENCY_LABEL[urgensi]}). Atasan akan segera menindaklanjuti.`);
    if (task.assigned_by) {
      const { data: atasan } = await admin
        .from('users')
        .select('telegram_chat_id')
        .eq('id', task.assigned_by)
        .maybeSingle();
      if (atasan?.telegram_chat_id) {
        await notifyTelegram(admin, atasan.telegram_chat_id, `🚨 <b>PROBLEM REPORT</b> — ${URGENCY_LABEL[urgensi]}\n${task.title}\n\n${isUrgensi ? deskripsi.split(/\s+/).slice(1).join(' ') : deskripsi}`);
      }
    }
    return true;
  }

  if (ctx.action === 'update') {
    await admin.from('tasks').update({ status: 'in_progress' }).eq('id', taskId);
    const note = text?.trim() || 'updating…';
    await sendTelegramMessage(chatId, `📝 Oke, progress dicatat: <i>${note}</i>\nTask kamu sekarang <b>Sedang dikerjakan</b>.`);
    return true;
  }

  if (ctx.action === 'selesai') {
    const catatan = text?.trim() || 'Selesai dikerjakan via bot.';
    await admin.from('task_reports').insert({
      task_id: taskId,
      user_id: task.assigned_to,
      progress_note: catatan,
      photo_url: null,
      status: 'report_submitted',
    });
    await admin.from('tasks').update({ status: 'report_submitted' }).eq('id', taskId);
    await sendTelegramMessage(chatId, '✅ Laporan selesai terkirim. Menunggu approval atasan ya.');

    if (task.assigned_by) {
      const { data: atasan } = await admin
        .from('users')
        .select('telegram_chat_id')
        .eq('id', task.assigned_by)
        .maybeSingle();
      if (atasan?.telegram_chat_id) {
        await notifyTelegram(admin, atasan.telegram_chat_id, `✅ <b>Completion report</b> (via bot)\n${task.title}\n\n${catatan}\n\nMenunggu approval.`);
      }
    }
    return true;
  }

  return false;
}

// ---------- Alur /laporan & /request ----------
// Tidak wajib terdaftar; pelapor diminta nama → NPK → deskripsi. Data masuk ke
// tabel `external_requests` dan notif ke admin/channel dengan tombol aksi.

async function handleStartExternalReport(admin, msg, chatId, type) {
  await admin.from('telegram_external_convos').upsert({
    chat_id: String(chatId),
    type,
    step: 'nama',
    nama: null,
    npk: null,
  });
  const prompt =
    type === 'problem'
      ? 'Baik, kita buat laporan masalah umum. Siapa nama lengkap kamu?'
      : 'Oke, kita ajukan permintaan improvement. Siapa nama lengkap kamu?';
  await sendTelegramMessage(chatId, prompt);
}

async function handleExternalReportInput(admin, msg, chatId, text) {
  const { data: ctx } = await admin
    .from('telegram_external_convos')
    .select('*')
    .eq('chat_id', String(chatId))
    .maybeSingle();
  if (!ctx) return false;

  if (ctx.step === 'nama') {
    if (!text) {
      await sendTelegramMessage(chatId, 'Tulis nama kamu dulu ya.');
      return true;
    }
    await admin.from('telegram_external_convos').update({ step: 'npk', nama: text.trim() }).eq('chat_id', String(chatId));
    await sendTelegramMessage(chatId, 'Terima kasih. Berapa NPK kamu? (kalau tidak ada, ketik <code>-</code>)');
    return true;
  }

  if (ctx.step === 'npk') {
    const npk = text.trim() === '-' ? null : text.trim();
    await admin.from('telegram_external_convos').update({ step: 'deskripsi', npk }).eq('chat_id', String(chatId));
    await sendTelegramMessage(
      chatId,
      ctx.type === 'problem'
        ? 'Jelaskan masalah yang ingin dilaporkan ke tim engineering.'
        : 'Jelaskan improvement yang kamu usulkan.'
    );
    return true;
  }

  if (ctx.step === 'deskripsi') {
    const deskripsi = text?.trim();
    await admin.from('telegram_external_convos').delete().eq('chat_id', String(chatId));
    if (!deskripsi) {
      await sendTelegramMessage(chatId, 'Deskripsi tidak boleh kosong. Coba lagi dengan /laporan atau /request ya.');
      return true;
    }

    const { data: row, error } = await admin
      .from('external_requests')
      .insert({
        type: ctx.type,
        nama: ctx.nama,
        npk: ctx.npk,
        telegram_chat_id: String(chatId),
        description: deskripsi,
        status: 'open',
      })
      .select('*')
      .single();

    if (error) {
      await sendTelegramMessage(chatId, 'Maaf, laporan gagal tersimpan. Coba lagi ya.');
      return true;
    }

    await broadcastExternalRequest(admin, row);
    await emailExternalReport(admin, { type: ctx.type, nama: row.nama, npk: row.npk, deskripsi: row.description });

    await sendTelegramMessage(
      chatId,
      ctx.type === 'problem'
        ? '✅ Laporan masalah kamu sudah diterima tim engineering. Terima kasih!'
        : '✅ Permintaan improvement kamu sudah diterima. Terima kasih!'
    );
    return true;
  }

  return false;
}

// ---------- Pick up / Reject laporan umum & request ----------
// Siapa pun yang chat_id-nya sudah tertaut ke akun boleh pick up; reject hanya
// SPV ke atas. First-come-first-served lewat cek status = 'open'.

// Ambil user dari chat_id sender; return null bila belum tertaut.
async function findUserByChatId(admin, chatId) {
  const { data } = await admin
    .from('users')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .maybeSingle();
  return data || null;
}

async function handleExternalPickup(admin, cq, requestId, messageId) {
  const chatId = cq.message?.chat?.id;
  const senderId = String(cq.from?.id || '');

  const user = await findUserByChatId(admin, senderId);
  if (!user) {
    await answerCallback(cq.id, 'Kamu belum terdaftar. Ketik /start untuk menautkan akun.');
    return;
  }

  // Ambil row + lock dengan cek status; hanya boleh pickup saat masih open.
  const { data: row } = await admin
    .from('external_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (!row) {
    await answerCallback(cq.id, 'Laporan tidak ditemukan.');
    return;
  }
  if (row.status !== 'open') {
    await answerCallback(cq.id, 'Laporan ini sudah diambil/ditutup.');
    await editMessageText(chatId, messageId, `✅ <b>Sudah ditangani</b>\n${externalRequestText(row)}`);
    return;
  }

  const atasanId = user.atasan_id;

  // Buat task dari laporan/request.
  const { data: task, error: taskErr } = await admin
    .from('tasks')
    .insert({
      assigned_by: atasanId,
      assigned_to: user.id,
      title: `[${row.type === 'problem' ? 'Laporan' : 'Request'}] ${row.description.slice(0, 80)}`,
      description: `Laporan dari ${row.nama}${row.npk ? ` (NPK ${row.npk})` : ''}.\n\n${row.description}`,
      points: 0,
      deadline: null,
      status: 'assigned',
    })
    .select('*')
    .single();

  if (taskErr) {
    await answerCallback(cq.id, `Gagal membuat task: ${taskErr.message}`);
    return;
  }

  const { error: updErr } = await admin
    .from('external_requests')
    .update({ status: 'picked', picked_by: user.id, task_id: task.id })
    .eq('id', requestId)
    .eq('status', 'open');

  if (updErr) {
    await answerCallback(cq.id, 'Laporan sudah diambil orang lain.');
    await editMessageText(chatId, messageId, `✅ <b>Sudah ditangani</b>\n${externalRequestText(row)}`);
    return;
  }

  await answerCallback(cq.id, 'Task dibuat untuk kamu ✅');
  await editMessageText(
    chatId,
    messageId,
    `🙋 <b>Pick up oleh ${user.nama}</b>\n${externalRequestText(row)}`
  );

  await sendTelegramMessage(
    senderId,
    `📋 <b>Task baru dari pick up</b>\n${task.title}\n\nKamu yang menangani laporan/request ini. Selesaikan dan lapor seperti task biasa.\n\n🔖 #task_${task.id}`
  );

  // Notif task baru ke atasan via email (jika ada email atasan).
  await emailTaskAssigned(admin, user.id, task);
}

async function handleExternalReject(admin, cq, requestId, messageId) {
  const chatId = cq.message?.chat?.id;
  const senderId = String(cq.from?.id || '');

  const user = await findUserByChatId(admin, senderId);
  if (!user || !isAtasan(user)) {
    await answerCallback(cq.id, 'Hanya SPV ke atas yang boleh reject.');
    return;
  }

  const { data: row } = await admin
    .from('external_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (!row) {
    await answerCallback(cq.id, 'Laporan tidak ditemukan.');
    return;
  }
  if (row.status !== 'open') {
    await answerCallback(cq.id, 'Laporan ini sudah ditangani.');
    return;
  }

  await admin
    .from('external_requests')
    .update({ status: 'rejected', rejected_by: user.id })
    .eq('id', requestId)
    .eq('status', 'open');

  await answerCallback(cq.id, 'Laporan ditutup ❌');
  await editMessageText(
    chatId,
    messageId,
    `❌ <b>Ditolak oleh ${user.nama}</b>\n${externalRequestText(row)}`
  );
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

// ---------- /help ----------
async function handleHelp(chatId) {
  await sendTelegramMessage(
    chatId,
    'Berikut perintah bot ini 🤖\n\n' +
      '<b>Perintah</b>\n' +
      '/start — Mulai atau daftarkan diri.\n' +
      '/laporan — Laporkan masalah umum (tanpa akun, cukup nama & NPK).\n' +
      '/request — Ajukan permintaan improvement (tanpa akun).\n' +
      '/help — Tampilkan bantuan (ini).\n\n' +
      '<b>Lapor task</b> (balas notifikasi task yang ada tag #task_...)\n' +
      '• Lampirkan <b>foto</b> saat membalas → lapor selesai.\n' +
      '• Balas dengan <b>teks</b> → lapor masalah. Awali dengan "mendesak", "perlu hari ini", atau "bisa nunggu".\n\n' +
      '<b>Laporan/request umum</b>\n' +
      '• Notifikasi laporan memuat tombol <b>Pick up</b> (ambil & jadi task kamu) dan <b>Reject</b> (hanya SPV ke atas).\n\n' +
      '<b>Admin group/channel</b>\n' +
      '/daftargrup — daftarkan group/channel penerima notifikasi (jalankan di dalam group/channel).\n' +
      '/hapusgrup — hapus group/channel dari daftar notifikasi.\n\n' +
      `Belum punya akun? Ketik /start dan masukkan NPK untuk menautkan akun web. 💻 Web app: <a href="${WEB_APP_URL}">app.machapp.web.id</a>`
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
    if (g >= 5) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Golongan ${g} (level atasan) butuh <b>verifikasi admin</b> — golongan final ditetapkan oleh SPV/ASM/SM penyetuju, bukan berdasarkan klaimmu.`
      );
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

  // P0 guard: golongan final dibatasi kapasitas si penyetuju. Penyetuju yang belum
  // punya akun web (tidak dikenal) dipatok maks. pelaksana (golongan 4); atasan
  // terverifikasi (>= 5) dapat menetapkan maks. level-1-nya; non-atasan ditolak.
  let maxG = 4;
  const approverChat = String(cq?.from?.id || '');
  if (approverChat) {
    const { data: approver } = await admin
      .from('users')
      .select('golongan')
      .eq('telegram_chat_id', approverChat)
      .maybeSingle();
    if (approver && Number(approver.golongan) >= 5) {
      maxG = Number(approver.golongan) - 1;
    } else if (approver) {
      await sendTelegramMessage(cq.message?.chat?.id, '⛔ Hanya atasan (SPV ke atas) yang boleh menyetujui pendaftaran.');
      return;
    }
  }

  const klaimG = Math.max(1, Number(pending.golongan) || 1);
  const finalG = Math.min(klaimG, maxG);
  const finalTitle =
    finalG >= 5
      ? (ATASAN_TITLES.includes(pending.title) ? pending.title : golonganLabel(finalG))
      : (pending.title && !ATASAN_TITLES.includes(pending.title) ? pending.title : golonganLabel(finalG));

  const { data: user, error } = await admin
    .from('users')
    .insert({
      nama: pending.nama,
      npk: pending.npk,
      golongan: finalG,
      title: finalTitle,
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
  const catatan = klaimG !== finalG
    ? ` — klaim ${klaimG} disesuaikan ke golongan ${finalG} oleh penyetuju.`
    : ` (golongan ${finalG})`;
  await sendTelegramMessage(chatId, `🎉 Selamat, ${pending.nama}! Akun kamu sudah aktif${catatan} Ketik /start untuk mulai.`);

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
