import { createAdminClient } from '@/lib/supabase';
import { jsonOk, jsonError } from '@/lib/auth';

// POST /api/registerApprove — internal (dari callback query admin)
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const { chatId, approvedBy, golonganFinal, atasanId } = body || {};

  if (!chatId) return jsonError(400, 'INVALID_ARGUMENT', 'chatId wajib diisi');

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .eq('chat_id', String(chatId))
    .maybeSingle();

  if (!pending) return jsonError(404, 'NOT_FOUND', 'Registrasi pending tidak ditemukan');

  const { data: user, error } = await admin
    .from('users')
    .insert({
      nama: pending.nama,
      nik: pending.nik,
      golongan: golonganFinal != null ? Number(golonganFinal) : pending.golongan,
      atasan_id: atasanId || null,
      telegram_chat_id: String(chatId),
    })
    .select('id')
    .single();

  if (error) return jsonError(500, 'INTERNAL', error.message);

  await admin.from('pending_registrations').delete().eq('chat_id', String(chatId));

  return jsonOk({ userId: user.id, approvedBy: approvedBy || null });
}
