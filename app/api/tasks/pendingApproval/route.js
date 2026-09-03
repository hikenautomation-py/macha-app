import { requireAtasan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { mapTask, mapReport } from '@/lib/mappers';
import { getSubordinateIds, taskScopeOr } from '@/lib/hierarchy';

// GET /api/tasks/pendingApproval — task menunggu approval (golongan >= 5)
// Setiap task disertai laporan pending-nya (reportId + catatan + nama pelapor),
// supaya dashboard atasan bisa langsung menampilkan tombol approve/reject.
// Cakupan: task yang dia buat sendiri ATAU yang dikerjakan bawahannya —
// task hasil pick-up laporan bisa punya `assigned_by` kosong sehingga tidak
// akan pernah muncul kalau antrian hanya difilter `assigned_by`.
export async function GET(req) {
  const { profile, error } = await requireAtasan(req);
  if (error) return error;

  const admin = createAdminClient();
  const subs = await getSubordinateIds(admin, profile.id);
  const scope = taskScopeOr(profile.id, subs);

  let query = admin
    .from('tasks')
    .select('*')
    .eq('status', 'report_submitted')
    .order('created_at', { ascending: false });
  query = scope ? query.or(scope) : query.eq('assigned_by', profile.id);

  const { data, error: err } = await query;

  if (err) return jsonError(500, 'INTERNAL', err.message);

  const tasks = data || [];
  const result = [];

  for (const t of tasks) {
    const { data: report } = await admin
      .from('task_reports')
      .select('*')
      .eq('task_id', t.id)
      .eq('status', 'report_submitted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let namaPelapor = null;
    if (report?.user_id) {
      const { data: u } = await admin.from('users').select('nama').eq('id', report.user_id).maybeSingle();
      namaPelapor = u?.nama || null;
    }

    result.push({
      ...mapTask(t),
      report: report ? { ...mapReport(report), namaPelapor } : null,
    });
  }

  return jsonOk(result);
}
