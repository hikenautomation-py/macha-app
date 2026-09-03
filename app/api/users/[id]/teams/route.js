import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { getUserTeams } from '@/lib/teams';
import { getViewableUserIds } from '@/lib/hierarchy';

// GET /api/users/{id}/teams — daftar team yang diikuti user.
// Boleh dilihat oleh user itu sendiri atau atasannya (subtree). Dipakai halaman
// /profile untuk menampilkan nama tim.
export async function GET(req, { params }) {
  const { profile, error } = await requireAuth(req);
  if (error) return error;

  const admin = createAdminClient();
  const viewable = await getViewableUserIds(admin, profile);
  if (!viewable.includes(params.id)) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu hanya bisa melihat tim kamu sendiri atau bawahan kamu');
  }

  return jsonOk(await getUserTeams(admin, params.id));
}
