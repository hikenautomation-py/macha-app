import { requireGolongan, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { mapTask, mapReport } from '@/lib/mappers';

// GET /api/tasks/pendingApproval?atasanId= — task menunggu approval (golongan >= 5)
// Setiap task disertai laporan pending-nya (reportId + catatan + nama pelapor),
// supaya dashboard atasan bisa langsung menampilkan tombol approve/reject.
export async function GET(req) {
  const { profile, error } = await requireGolongan(req, 5);
  if (error) return error;

  const url = new URL(req.url);
  const atasanId = url.searchParams.get('atasanId') || profile.id;

  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from('tasks')
    .select('*')
    .eq('assigned_by', atasanId)
    .eq('status', 'report_submitted')
    .order('created_at', { ascending: false });

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
