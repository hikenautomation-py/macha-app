import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getSubordinateIds } from '@/lib/hierarchy';

// POST /api/teams/{id}/members — tambah/hapus anggota team.
// Hanya lead/creator team yang boleh; target harus di subtree bawahan manager.
export async function POST(req, { params }) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { userId, action } = body || {};
  if (!userId) return jsonError(400, 'INVALID_ARGUMENT', 'userId wajib diisi');
  if (!['add', 'remove'].includes(action)) {
    return jsonError(400, 'INVALID_ARGUMENT', 'action harus add atau remove');
  }

  const admin = createAdminClient();
  const { data: team } = await admin.from('teams').select('*').eq('id', params.id).maybeSingle();
  if (!team) return jsonError(404, 'NOT_FOUND', 'Team tidak ditemukan');

  const isOwner = team.lead_id === profile.id || team.created_by === profile.id;
  if (!isOwner) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu bukan lead/creator team ini');
  }

  const subs = await getSubordinateIds(admin, profile.id);
  const targetValid = userId === profile.id || subs.includes(userId);
  if (!targetValid) {
    return jsonError(403, 'PERMISSION_DENIED', 'Target harus kamu sendiri atau bawahan kamu');
  }

  if (action === 'add') {
    await admin.from('team_members').upsert(
      { team_id: team.id, user_id: userId, role: 'member' },
      { onConflict: 'team_id,user_id' }
    );
    // Sinkronisasi edge pelaporan: anggota berada di bawah lead team.
    await admin.from('users').update({ atasan_id: team.lead_id }).eq('id', userId);
    return jsonOk({ status: 'added' });
  }

  await admin.from('team_members').delete().eq('team_id', team.id).eq('user_id', userId);
  const { data: u } = await admin.from('users').select('atasan_id').eq('id', userId).maybeSingle();
  if (u?.atasan_id === team.lead_id) {
    await admin.from('users').update({ atasan_id: null }).eq('id', userId);
  }
  return jsonOk({ status: 'removed' });
}
