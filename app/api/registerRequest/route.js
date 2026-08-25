import { createAdminClient } from '@/lib/supabase';
import { jsonOk, jsonError } from '@/lib/auth';

// POST /api/registerRequest — internal (dipanggil dari handler webhook Telegram)
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const { chatId, nama, nik, golonganKlaim } = body || {};

  if (!chatId || !nama || !nik) {
    return jsonError(400, 'INVALID_ARGUMENT', 'chatId, nama, dan nik wajib diisi');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('pending_registrations').upsert({
    chat_id: String(chatId),
    nama,
    nik,
    golongan: Number(golonganKlaim) || 1,
    status: 'pending',
  });

  if (error) return jsonError(500, 'INTERNAL', error.message);
  return jsonOk({ status: 'pending' });
}
