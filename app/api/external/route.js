import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { emailExternalReport } from '@/lib/email';
import { broadcastExternalRequest } from '@/lib/external';

const TYPES = ['problem', 'improvement'];

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

  await broadcastExternalRequest(admin, row);
  await emailExternalReport(admin, { type: row.type, nama: row.nama, npk: row.npk, deskripsi: row.description });

  return jsonOk({ requestId: row.id });
}

// GET /api/external?type=&status= — daftar laporan umum / request (semua user login).
export async function GET(req) {
  const { error } = await requireAuth(req);
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
