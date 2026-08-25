import { createAdminClient } from '@/lib/supabase';
import { jsonOk, jsonError } from '@/lib/auth';

// POST /api/registerReject — internal (dari callback query admin)
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const { chatId } = body || {};

  if (!chatId) return jsonError(400, 'INVALID_ARGUMENT', 'chatId wajib diisi');

  const admin = createAdminClient();
  await admin.from('pending_registrations').delete().eq('chat_id', String(chatId));

  // Pesan penolakan dikirim oleh pemanggil (handler webhook), agar punya konteks.
  return jsonOk({ status: 'rejected' });
}
