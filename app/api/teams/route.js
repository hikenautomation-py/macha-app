import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getSubordinateIds } from '@/lib/hierarchy';

// GET /api/teams — daftar team yang dikelola (lead/creator = diri sendiri)
export async function GET(req) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from('teams')
    .select('*')
    .or(`lead_id.eq.${profile.id},created_by.eq.${profile.id}`)
    .order('created_at', { ascending: false });

  if (err) return jsonError(500, 'INTERNAL', err.message);

  const teams = [];
  for (const t of data || []) {
    const { data: members } = await admin
      .from('team_members')
      .select('user_id, role, users(id, nama, npk, golongan, title)')
      .eq('team_id', t.id);
    teams.push({ ...t, members: members || [] });
  }

  return jsonOk(teams);
}

// POST /api/teams — buat team (lead default = diri sendiri)
export async function POST(req) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { nama, leadId } = body || {};
  if (!nama || !String(nama).trim()) {
    return jsonError(400, 'INVALID_ARGUMENT', 'nama team wajib diisi');
  }

  const admin = createAdminClient();
  const resolvedLeadId = leadId || profile.id;

  // Lead harus diri sendiri atau bawahan (subtree).
  if (resolvedLeadId !== profile.id) {
    const subs = await getSubordinateIds(admin, profile.id);
    if (!subs.includes(resolvedLeadId)) {
      return jsonError(403, 'PERMISSION_DENIED', 'Lead team harus kamu sendiri atau bawahan kamu');
    }
  }

  const { data: team, error: insErr } = await admin
    .from('teams')
    .insert({ nama: String(nama).trim(), lead_id: resolvedLeadId, created_by: profile.id })
    .select('*')
    .single();

  if (insErr) return jsonError(500, 'INTERNAL', insErr.message);

  await admin.from('team_members').insert({
    team_id: team.id,
    user_id: resolvedLeadId,
    role: 'lead',
  });

  return jsonOk(team);
}
