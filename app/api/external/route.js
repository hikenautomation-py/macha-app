import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { notifyTelegram, sendTelegramMessage } from '@/lib/telegram';
import { emailExternalReport } from '@/lib/email';

const TYPES = ['problem', 'improvement'];
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// POST /api/external — publik (service role). Dipakai form web & bot Telegram.
// Tidak wajib login; targetnya seksi lain (mis. produksi) yang tidak punya akun.
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const { type, nama, npk, deskripsi, telegramChatId } = body || {};

  if (!TYPES.includes(type)) {
    return jsonError(400, 'INVALID_ARGUMENT', 'type harus problem atau improvement');
  }
  if (!nama || !String(nama).trim()) {
    return jsonError(400, 'INVALID_ARGUMENT', 'nama wajib diisi');
  }
  if (!deskripsi || !String(deskripsi).trim()) {
    return jsonError(400, 'INVALID_ARGUMENT', 'deskripsi wajib diisi');
  }
  if (String(nama).length > 120 || String(deskripsi).length > 2000) {
    return jsonError(400, 'INVALID_ARGUMENT', 'nama/deskripsi terlalu panjang');
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('external_requests')
    .insert({
      type,
      nama: String(nama).trim(),
      npk: String(npk || '').trim() || null,
      telegram_chat_id: telegramChatId ? String(telegramChatId) : null,
      description: String(deskripsi).trim(),
      status: 'open',
    })
    .select('*')
    .single();

  if (error) return jsonError(500, 'INTERNAL', error.message);

  const label = type === 'problem' ? '🚨 LAPORAN MASALAH' : '💡 PERMINTAAN IMPROVEMENT';
  const text = `${label}\nDari: ${row.nama}${row.npk ? ` (NPK ${row.npk})` : ''}\n\n${row.description}`;

  if (ADMIN_CHAT_ID) await sendTelegramMessage(ADMIN_CHAT_ID, text);
  await notifyTelegram(admin, null, text);
  await emailExternalReport(admin, { type, nama: row.nama, npk: row.npk, deskripsi: row.description });

  return jsonOk({ requestId: row.id });
}

// GET /api/external?type=&status= — daftar laporan umum / request (atasan).
export async function GET(req) {
  const { error } = await requireAtasan(req);
  if (error) return error;

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');

  const admin = createAdminClient();
  let q = admin.from('external_requests').select('*').order('created_at', { ascending: false });
  if (type) q = q.eq('type', type);
  if (status) q = q.eq('status', status);

  const { data, error: err } = await q;
  if (err) return jsonError(500, 'INTERNAL', err.message);
  return jsonOk(data || []);
}
