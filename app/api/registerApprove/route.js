import { createAdminClient } from '@/lib/supabase';
import { jsonOk, jsonError } from '@/lib/auth';
import { ATASAN_TITLES, golonganLabel } from '@/lib/constants';

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

  // P0 guard — golongan final dibatasi kapasitas penyetuju (approvedBy).
  // Penyetuju tak dikenal dipatok batas pelaksana (4); atasan >= 5 bisa
  // menetapkan maks. level-1-nya; non-atasan menolak approve.
  let maxG = 4;
  if (approvedBy != null) {
    const { data: approver } = await admin
      .from('users')
      .select('golongan')
      .eq('telegram_chat_id', String(approvedBy))
      .maybeSingle();
    if (approver && Number(approver.golongan) >= 5) {
      maxG = Number(approver.golongan) - 1;
    } else if (approver) {
      return jsonError(403, 'PERMISSION_DENIED', 'Hanya atasan (level >= 5) yang boleh menyetujui pendaftaran');
    }
  }
  const klaimG = Math.max(1, golonganFinal != null ? Number(golonganFinal) : Number(pending.golongan) || 1);
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
      atasan_id: atasanId || null,
      telegram_chat_id: String(chatId),
    })
    .select('id')
    .single();

  if (error) return jsonError(500, 'INTERNAL', error.message);

  await admin.from('pending_registrations').delete().eq('chat_id', String(chatId));

  return jsonOk({ userId: user.id, approvedBy: approvedBy || null });
}
