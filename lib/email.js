const RESEND_API_URL = 'https://api.resend.com/emails';
const EMAIL_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function shell(title, bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#111827;color:#ffffff;padding:16px 24px;font-weight:700;">Macha App &middot; Task Tracker</div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 16px;font-size:18px;line-height:1.4;">${title}</h2>
        ${bodyHtml}
      </div>
    </div>
  </body>
</html>`;
}

function row(label, value) {
  return `<p style="margin:0 0 8px;"><span style="color:#6b7280;">${label}:</span> ${value}</p>`;
}

/**
 * Kirim email via Resend. Aman dipanggil tanpa konfigurasi (return null).
 * @param {object} p
 * @param {string} p.to      alamat email penerima
 * @param {string} p.subject subjek email
 * @param {string} p.html    isi HTML
 * @param {string} [p.text]  isi plain text (fallback)
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!EMAIL_API_KEY || !EMAIL_FROM || !to) return null;
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html: html || text,
        text: text || undefined,
      }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Ambil alamat email user berdasarkan id.
 * Prioritas: kolom `email` di public.users (diisi trigger handle_new_user untuk
 * akun web, dan saat approval untuk akun Telegram). Fallback: auth.users
 * (akun web lama yang dibuat sebelum kolom email di-backfill).
 */
export async function getUserEmail(admin, userId) {
  if (!admin || !userId) return null;
  try {
    const { data: row } = await admin.from('users').select('email').eq('id', userId).maybeSingle();
    if (row?.email) return row.email;
  } catch {
    // lanjut ke fallback
  }
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

// ---------- Template notifikasi ----------

/** 📋 Task baru → ke pelaksana (assigned_to). */
export async function emailTaskAssigned(admin, userId, task) {
  const to = await getUserEmail(admin, userId);
  if (!to) return null;
  const body =
    row('Task', esc(task?.title)) +
    (task?.description ? row('Deskripsi', esc(task.description)) : '') +
    (task?.deadline ? row('Deadline', esc(task.deadline)) : '') +
    row('Bobot', `${Number(task?.points) || 0} poin`);
  return sendEmail({
    to,
    subject: `📋 Task baru: ${task?.title || ''}`,
    html: shell('Task baru ditugaskan kepadamu', body),
  });
}

/** ✅ Completion report masuk → ke atasan (assigned_by). */
export async function emailReportSubmitted(admin, userId, task, pelaksanaNama) {
  const to = await getUserEmail(admin, userId);
  if (!to) return null;
  const body =
    `<p style="margin:0 0 12px;">Ada laporan penyelesaian yang menunggu approval kamu.</p>` +
    row('Task', esc(task?.title)) +
    row('Dari', esc(pelaksanaNama));
  return sendEmail({
    to,
    subject: `✅ Completion report: ${task?.title || ''}`,
    html: shell('Completion report masuk', body),
  });
}

/** 🚨 Problem report → ke atasan (assigned_by), prioritas tinggi. */
export async function emailProblemReport(admin, userId, task, pelaksanaNama, urgencyLabel, deskripsi) {
  const to = await getUserEmail(admin, userId);
  if (!to) return null;
  const body =
    row('Urgensi', esc(urgencyLabel)) +
    row('Task', esc(task?.title)) +
    row('Dari', esc(pelaksanaNama)) +
    `<p style="margin:12px 0 0;padding:12px;background:#fef2f2;border-radius:8px;">${esc(deskripsi)}</p>`;
  return sendEmail({
    to,
    subject: `🚨 Problem report (${urgencyLabel}): ${task?.title || ''}`,
    html: shell('Problem report — prioritas tinggi', body),
  });
}

/** 🎉 Hasil approval (disetujui) → ke pelaksana (assigned_to). */
export async function emailTaskApproved(admin, userId, task, poin) {
  const to = await getUserEmail(admin, userId);
  if (!to) return null;
  const body =
    `<p style="margin:0 0 12px;">Task kamu disetujui. Mantap! 🎉</p>` +
    row('Task', esc(task?.title)) +
    row('Poin ditambahkan', `+${Number(poin) || 0}`);
  return sendEmail({
    to,
    subject: `🎉 Task disetujui: ${task?.title || ''}`,
    html: shell('Task disetujui', body),
  });
}

/** ↩️ Hasil approval (perlu revisi) → ke pelaksana (assigned_to). */
export async function emailTaskRejected(admin, userId, task, catatanRevisi) {
  const to = await getUserEmail(admin, userId);
  if (!to) return null;
  const body =
    `<p style="margin:0 0 12px;">Task kamu perlu revisi.</p>` +
    row('Task', esc(task?.title)) +
    (catatanRevisi ? `<p style="margin:12px 0 0;padding:12px;background:#fffbeb;border-radius:8px;">${esc(catatanRevisi)}</p>` : '');
  return sendEmail({
    to,
    subject: `↩️ Task perlu revisi: ${task?.title || ''}`,
    html: shell('Task perlu revisi', body),
  });
}

/** 🎉 Registrasi (web/Telegram) disetujui → email langsung ke pengguna. */
export async function emailRegistrationApproved(to, { nama, npk }) {
  if (!to) return null;
  const body =
    `<p style="margin:0 0 12px;">Akun kamu sudah di-<b>approve</b> dan aktif. 🎉</p>` +
    row('Nama', esc(nama)) +
    row('NPK', esc(npk)) +
    `<p style="margin:12px 0 0;">Kamu bisa membuka web app di <b>app.machapp.web.id</b> untuk melihat task, dan menerima notifikasi via email / Telegram.</p>`;
  return sendEmail({
    to,
    subject: '🎉 Akun Macha App aktif',
    html: shell('Registrasi disetujui', body),
  });
}
