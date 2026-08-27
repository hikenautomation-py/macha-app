import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// POST /api/external/{id}/resolve — tandai laporan umum/request selesai (atasan).
export async function POST(req, { params }) {
  const { error } = await requireAtasan(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const { keputusan } = body || {};

  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from('external_requests')
    .update({ status: 'resolved', keputusan: keputusan || null })
    .eq('id', params.id)
    .select('*')
    .single();

  if (err) return jsonError(500, 'INTERNAL', err.message);
  return jsonOk({ requestId: data.id, status: data.status });
}
