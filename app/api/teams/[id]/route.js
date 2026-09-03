import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// DELETE /api/teams/{id} — hapus team.
// Hanya lead/creator team yang boleh. Anggota (`team_members`) ikut dihapus;
// data user, task, dan poin tidak tersentuh — hanya pengelompokan tim yang hilang.
export async function DELETE(req, { params }) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const admin = createAdminClient();
  const { data: team } = await admin.from('teams').select('*').eq('id', params.id).maybeSingle();
  if (!team) return jsonError(404, 'NOT_FOUND', 'Team tidak ditemukan');

  const isOwner = team.lead_id === profile.id || team.created_by === profile.id;
  if (!isOwner) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu bukan lead/creator team ini');
  }

  const { error: delMemberErr } = await admin.from('team_members').delete().eq('team_id', team.id);
  if (delMemberErr) return jsonError(500, 'INTERNAL', delMemberErr.message);

  const { error: delErr } = await admin.from('teams').delete().eq('id', team.id);
  if (delErr) return jsonError(500, 'INTERNAL', delErr.message);

  return jsonOk({ status: 'deleted', teamId: team.id });
}
