const SUPABASE_URL = 'https://pnpzkdyamjnxhujhbwjw.supabase.co';
const ANON = 'sb_publishable_K-V-9uKqi4IuPLRh1pxfJA_ht0klB1r';
const BASE = 'https://macha-app-sigma.vercel.app/api';

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`signIn ${email} failed: ${JSON.stringify(j)}`);
  return j;
}

async function api(token, method, path, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

(async () => {
  const log = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);

  const sm = await signIn('sm@macha-app.test', 'Macha2026!');
  const tech = await signIn('tech.andi@macha-app.test', 'Macha2026!');
  log('sign-in sm', !!sm.access_token, sm.user.email);
  log('sign-in tech', !!tech.access_token, tech.user.email);

  const smToken = sm.access_token;
  const techToken = tech.access_token;
  const smId = sm.user.id;
  const techId = tech.user.id;

  // Sprint 3 — security: tech (gol 3) tidak boleh buat task
  let r = await api(techToken, 'POST', '/tasks', { judul: 'x', ditugaskanKe: techId });
  log('S3: tech tidak boleh POST /tasks (403)', r.status === 403, `status=${r.status}`);

  // Sprint 3 — sm buat task utk tech
  r = await api(smToken, 'POST', '/tasks', { judul: 'Test task E2E', deskripsi: 'coba', ditugaskanKe: techId, bobotPoin: 10, deadline: '2026-09-01' });
  const taskId = r.json?.data?.taskId;
  log('S3: sm POST /tasks', r.status === 200 && !!taskId, `status=${r.status} taskId=${taskId}`);

  // Sprint 3 — tech lihat task miliknya
  r = await api(techToken, 'GET', `/tasks?userId=${techId}`);
  const found = (r.json?.data || []).some((t) => t.taskId === taskId);
  log('S3: tech GET /tasks?userId=', r.status === 200 && found, `status=${r.status} found=${found}`);

  // Sprint 4 — tech submit laporan selesai
  r = await api(techToken, 'POST', `/tasks/${taskId}/reports`, { catatan: 'Selesai dikerjakan' });
  const reportId = r.json?.data?.reportId;
  log('S4: tech POST report', r.status === 200 && !!reportId, `status=${r.status} reportId=${reportId}`);

  // Sprint 4 — sm lihat antrian approval
  r = await api(smToken, 'GET', `/tasks/pendingApproval?atasanId=${smId}`);
  const pending = (r.json?.data || []).find((t) => t.taskId === taskId);
  log('S4: sm GET pendingApproval', r.status === 200 && !!pending?.report, `status=${r.status} hasReport=${!!pending?.report}`);

  // Sprint 4 — sm approve (transaksi atomik status + poin)
  r = await api(smToken, 'POST', `/tasks/${taskId}/reports/${reportId}/approve`);
  log('S4: sm POST approve', r.status === 200, `status=${r.status} body=${JSON.stringify(r.json)}`);

  // Sprint 5 — cek poin tech
  r = await api(techToken, 'GET', `/users/${techId}/points`);
  log('S5: tech GET points', r.status === 200 && (r.json?.data?.totalPoin || 0) >= 10, `status=${r.status} totalPoin=${r.json?.data?.totalPoin}`);

  // Sprint 5 — problem report (task2)
  let r2 = await api(smToken, 'POST', '/tasks', { judul: 'Task problem test', ditugaskanKe: techId, bobotPoin: 5 });
  const taskId2 = r2.json?.data?.taskId;
  r = await api(techToken, 'POST', `/tasks/${taskId2}/problems`, { urgensi: 'mendesak', deskripsiMasalah: 'Line 2 downtime, sensor proximity error' });
  log('S5: tech POST problem', r.status === 200 && !!r.json?.data?.problemId, `status=${r.status}`);

  // Sprint 4 — reject → revisi → resubmit (task3)
  let r3 = await api(smToken, 'POST', '/tasks', { judul: 'Task reject test', ditugaskanKe: techId, bobotPoin: 3 });
  const taskId3 = r3.json?.data?.taskId;
  r = await api(techToken, 'POST', `/tasks/${taskId3}/reports`, { catatan: 'v1' });
  const reportId3 = r.json?.data?.reportId;
  r = await api(smToken, 'POST', `/tasks/${taskId3}/reports/${reportId3}/reject`, { catatanRevisi: 'foto kurang jelas' });
  log('S4: sm POST reject', r.status === 200, `status=${r.status}`);
  r = await api(techToken, 'GET', `/tasks?userId=${techId}&status=in_progress`);
  const inProgress = (r.json?.data || []).some((t) => t.taskId === taskId3);
  log('S4: task kembali in_progress setelah reject', r.status === 200 && inProgress, `status=${r.status}`);
  r = await api(techToken, 'POST', `/tasks/${taskId3}/reports`, { catatan: 'v2 revisi' });
  log('S4: resubmit report', r.status === 200, `status=${r.status}`);

  // Sprint 5 — stats tim atasan
  r = await api(smToken, 'GET', `/teams/${smId}/stats`);
  log('S5: sm GET teams stats', r.status === 200, `status=${r.status} rows=${(r.json?.data || []).length} ${JSON.stringify(r.json?.data || [])}`);

  console.log('DONE');
})().catch((e) => {
  console.error('TEST_ERR', e.message);
  process.exitCode = 1;
});
