'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { isAtasan, URGENCY_LABEL } from '@/lib/constants';
import AppBar from '@/components/AppBar';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import { IconCheck, IconArrowBackUp, IconAlertTriangle, IconBulb } from '@tabler/icons-react';

export default function Dashboard() {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [pending, setPending] = useState([]);
  const [summary, setSummary] = useState({});
  const [team, setTeam] = useState([]);
  const [problems, setProblems] = useState([]);
  const [externals, setExternals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [revisiFor, setRevisiFor] = useState(null);
  const [revisiNote, setRevisiNote] = useState('');
  const [resolveFor, setResolveFor] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [assignFor, setAssignFor] = useState(null);
  const [assignTarget, setAssignTarget] = useState('');

  const load = useCallback(async () => {
    if (!token || !profile) return;
    setError('');
    setLoadingData(true);
    try {
      const [pRes, sRes, tRes, probRes, extRes] = await Promise.all([
        apiFetch(token, '/api/tasks/pendingApproval'),
        apiFetch(token, '/api/dashboard/summary'),
        apiFetch(token, `/api/teams/${profile.id}/stats`),
        apiFetch(token, '/api/problems?status=open'),
        apiFetch(token, '/api/external?status=open'),
      ]);
      if (!pRes.ok) setError(apiErrorMessage(pRes));
      else setPending(pRes.json?.data || []);
      if (!sRes.ok) setError((e) => e || apiErrorMessage(sRes));
      else setSummary(sRes.json?.data || {});
      if (!tRes.ok) setError((e) => e || apiErrorMessage(tRes));
      else setTeam(tRes.json?.data || []);
      if (!probRes.ok) setError((e) => e || apiErrorMessage(probRes));
      else setProblems(probRes.json?.data || []);
      if (!extRes.ok) setError((e) => e || apiErrorMessage(extRes));
      else setExternals(extRes.json?.data || []);
    } finally {
      setLoadingData(false);
    }
  }, [token, profile]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (profile && !isAtasan(profile)) {
      router.replace('/tech');
      return;
    }
    if (profile) load();
  }, [loading, session, profile, router, load]);

  useEffect(() => {
    if (!assignFor) return;
    function onKey(e) {
      if (e.key === 'Escape') setAssignFor(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assignFor]);

  async function approve(task) {
    if (!task.report?.reportId) return;
    setBusyId(task.taskId);
    const res = await apiFetch(token, `/api/tasks/${task.taskId}/reports/${task.report.reportId}/approve`, {
      method: 'POST',
      body: {},
    });
    if (!res.ok) setError(apiErrorMessage(res));
    setBusyId(null);
    await load();
  }

  function openRevisi(task) {
    setRevisiFor(task.taskId);
    setRevisiNote('');
    setError('');
  }

  async function submitRevisi(task) {
    if (!task.report?.reportId) return;
    if (!revisiNote.trim()) {
      setError('Isi dulu catatan revisi untuk pelaksana.');
      return;
    }
    setBusyId(task.taskId);
    const res = await apiFetch(token, `/api/tasks/${task.taskId}/reports/${task.report.reportId}/reject`, {
      method: 'POST',
      body: { catatanRevisi: revisiNote.trim() },
    });
    if (!res.ok) setError(apiErrorMessage(res));
    setBusyId(null);
    setRevisiFor(null);
    setRevisiNote('');
    await load();
  }

  function openResolve(item) {
    setResolveFor(item);
    setResolveNote('');
    setError('');
  }

  async function submitResolveProblem(item) {
    if (!resolveNote.trim()) {
      setError('Isi dulu keputusan / tindakan yang diambil.');
      return;
    }
    setBusyId(item.problemId);
    const res = await apiFetch(token, `/api/tasks/${item.taskId}/problems/${item.problemId}/resolve`, {
      method: 'POST',
      body: { keputusan: resolveNote.trim() },
    });
    if (!res.ok) setError(apiErrorMessage(res));
    setBusyId(null);
    setResolveFor(null);
    setResolveNote('');
    await load();
  }

  async function submitResolveExternal(item) {
    if (!resolveNote.trim()) {
      setError('Isi dulu keputusan / tindakan yang diambil.');
      return;
    }
    setBusyId(item.id);
    const res = await apiFetch(token, `/api/external/${item.id}/resolve`, {
      method: 'POST',
      body: { keputusan: resolveNote.trim() },
    });
    if (!res.ok) setError(apiErrorMessage(res));
    setBusyId(null);
    setResolveFor(null);
    setResolveNote('');
    await load();
  }

  function openAssign(item) {
    setAssignFor(item);
    setAssignTarget('');
    setError('');
  }

  async function submitAssign() {
    if (!assignFor) return;
    if (!assignTarget) {
      setError('Pilih dulu bawahan yang ditugaskan.');
      return;
    }
    setBusyId(assignFor.id);
    const res = await apiFetch(token, `/api/external/${assignFor.id}/assign`, {
      method: 'POST',
      body: { assignedTo: assignTarget },
    });
    if (!res.ok) setError(apiErrorMessage(res));
    setBusyId(null);
    setAssignFor(null);
    setAssignTarget('');
    await load();
  }

  return (
    <div className="container">
      <AppBar
        actions={
          <>
            <button className="btn" onClick={() => router.push('/teams')}>Kelola tim</button>
            <button className="btn btn-primary" onClick={() => router.push('/tasks/new')}>+ Buat task</button>
            <button className="link-btn" onClick={() => signOut()}>Keluar</button>
          </>
        }
      />

      <div className="greet-blob">
        <h2>Halo, {profile?.nama || 'Atasan'}</h2>
        <p>Ini antrean approval & performa tim kamu.</p>
      </div>

      <div className="grid-metrics">
        <div className="metric">
          <div className="metric-label">Task aktif</div>
          <div className="metric-num">{summary.taskAktif ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Menunggu approval</div>
          <div className="metric-num">{summary.menungguApproval ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Problem report</div>
          <div className="metric-num">{summary.problemOpen ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Poin tim (bulan ini)</div>
          <div className="metric-num">{summary.totalPoinTim ?? 0}</div>
        </div>
      </div>

      {error ? <p className="err show" role="alert">{error}</p> : null}

      <div className="section-title">Antrean approval</div>
      {loadingData ? (
        <Loading />
      ) : pending.length === 0 ? (
        <EmptyState>Belum ada task yang menunggu approval.</EmptyState>
      ) : (
        pending.map((t) => (
          <div className="card" key={t.taskId} style={{ marginBottom: 12 }}>
            <div className="t-title">{t.judul}</div>
            <div className="t-meta" style={{ marginTop: 4 }}>
              Pelaksana: {t.report?.namaPelapor || '-'} · {t.bobotPoin} poin
            </div>
            {t.report?.catatan ? (
              <p className="muted" style={{ marginTop: 8 }}>“{t.report.catatan}”</p>
            ) : null}

            {revisiFor === t.taskId ? (
              <div style={{ marginTop: 12 }}>
                <label className="f-label" htmlFor={`revisi-${t.taskId}`}>Catatan revisi untuk pelaksana</label>
                <textarea
                  id={`revisi-${t.taskId}`}
                  className="f-input"
                  style={{ minHeight: 70 }}
                  value={revisiNote}
                  onChange={(e) => setRevisiNote(e.target.value)}
                  placeholder="Misal: foto belum jelas, ambil ulang dari sisi kanan mesin"
                />
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-danger-outline" disabled={busyId === t.taskId} onClick={() => submitRevisi(t)}>
                    {busyId === t.taskId ? 'Mengirim…' : 'Kirim revisi'}
                  </button>
                  <button className="link-btn" disabled={busyId === t.taskId} onClick={() => setRevisiFor(null)}>
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn btn-primary" disabled={busyId === t.taskId} onClick={() => approve(t)}>
                  <IconCheck size={16} aria-hidden="true" /> Setujui
                </button>
                <button className="btn btn-danger-outline" disabled={busyId === t.taskId} onClick={() => openRevisi(t)}>
                  <IconArrowBackUp size={16} aria-hidden="true" /> Revisi
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <div className="section-title">Problem report (task)</div>
      {problems.length === 0 ? (
        <EmptyState>Belum ada problem report yang terbuka.</EmptyState>
      ) : (
        problems.map((p) => (
          <div className="card" key={p.problemId} style={{ marginBottom: 12 }}>
            <div className="t-title">{p.judul}</div>
            <div className="t-meta" style={{ marginTop: 4 }}>
              {URGENCY_LABEL[p.urgensi] || p.urgensi} · {p.namaPelapor || '-'}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>“{p.deskripsiMasalah}”</p>

            {resolveFor?.problemId === p.problemId ? (
              <div style={{ marginTop: 12 }}>
                <label className="f-label" htmlFor={`resolve-${p.problemId}`}>Keputusan / tindakan</label>
                <textarea
                  id={`resolve-${p.problemId}`}
                  className="f-input"
                  style={{ minHeight: 70 }}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Tindakan yang diambil untuk menyelesaikan masalah"
                />
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" disabled={busyId === p.problemId} onClick={() => submitResolveProblem(p)}>
                    {busyId === p.problemId ? 'Mengirim…' : 'Tandai selesai'}
                  </button>
                  <button className="link-btn" onClick={() => setResolveFor(null)}>Batal</button>
                </div>
              </div>
            ) : (
              <button className="btn" style={{ marginTop: 12 }} onClick={() => openResolve(p)}>Resolve</button>
            )}
          </div>
        ))
      )}

      <div className="section-title">Laporan umum & request</div>
      {externals.length === 0 ? (
        <EmptyState>Belum ada laporan umum atau request yang terbuka.</EmptyState>
      ) : (
        externals.map((e) => (
          <div className="card" key={e.id} style={{ marginBottom: 12 }}>
            <div className="t-title">
                  {e.type === 'problem' ? (
                    <><IconAlertTriangle size={14} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Laporan masalah</>
                  ) : (
                    <><IconBulb size={14} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Permintaan improvement</>
                  )}
                </div>
            <div className="t-meta" style={{ marginTop: 4 }}>
              {e.nama}{e.npk ? ` · NPK ${e.npk}` : ''}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>“{e.description}”</p>

            {resolveFor?.id === e.id ? (
              <div style={{ marginTop: 12 }}>
                <label className="f-label" htmlFor={`resolve-ext-${e.id}`}>Keputusan / tindakan</label>
                <textarea
                  id={`resolve-ext-${e.id}`}
                  className="f-input"
                  style={{ minHeight: 70 }}
                  value={resolveNote}
                  onChange={(ev) => setResolveNote(ev.target.value)}
                  placeholder="Tindakan yang diambil"
                />
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" disabled={busyId === e.id} onClick={() => submitResolveExternal(e)}>
                    {busyId === e.id ? 'Mengirim…' : 'Tandai selesai'}
                  </button>
                  <button className="link-btn" onClick={() => setResolveFor(null)}>Batal</button>
                </div>
              </div>
            ) : (
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => openResolve(e)}>Resolve</button>
                <button className="btn" onClick={() => openAssign(e)}>Assign to</button>
              </div>
            )}
          </div>
        ))
      )}

      {assignFor ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setAssignFor(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 id="assign-title">Tugaskan ke bawahan</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              {assignFor.type === 'problem' ? (
                <><IconAlertTriangle size={14} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Laporan masalah</>
              ) : (
                <><IconBulb size={14} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Permintaan improvement</>
              )}{' '}
              dari {assignFor.nama}
            </p>
            <label className="f-label" htmlFor="assign-target" style={{ marginTop: 16 }}>Pilih bawahan</label>
            <select
              id="assign-target"
              className="f-input"
              value={assignTarget}
              onChange={(ev) => setAssignTarget(ev.target.value)}
            >
              <option value="">Pilih bawahan</option>
              {team.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.nama}{m.title ? ` · ${m.title}` : ''}
                </option>
              ))}
            </select>
            {team.length === 0 ? (
              <p className="muted" style={{ marginTop: 8 }}>Belum ada bawahan di tim kamu.</p>
            ) : null}
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled={busyId === assignFor.id} onClick={submitAssign}>
                {busyId === assignFor.id ? 'Menugaskan…' : 'Konfirmasi'}
              </button>
              <button className="link-btn" disabled={busyId === assignFor.id} onClick={() => setAssignFor(null)}>Batal</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="section-title">Statistik tim</div>
      {team.length === 0 ? (
        <EmptyState>Belum ada anggota tim. Bawahan akan muncul di sini setelah di-assign ke kamu.</EmptyState>
      ) : (
        <div className="card" style={{ padding: 6 }}>
          <table className="tidy">
            <tbody>
              <tr>
                <td>Nama</td>
                <td>Jabatan</td>
                <td style={{ textAlign: 'right' }}>Poin</td>
              </tr>
              {team.map((m) => (
                <tr key={m.userId}>
                  <td>{m.nama}</td>
                  <td>{m.title}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{m.poin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
