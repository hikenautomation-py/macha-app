'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';

export default function Dashboard() {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [pending, setPending] = useState([]);
  const [team, setTeam] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!token || !profile) return;
    setError('');
    setLoadingData(true);
    try {
      const [pRes, tRes] = await Promise.all([
        apiFetch(token, '/api/tasks/pendingApproval'),
        apiFetch(token, `/api/teams/${profile.id}/stats`),
      ]);
      if (!pRes.ok) setError(apiErrorMessage(pRes));
      else setPending(pRes.json?.data || []);
      if (!tRes.ok) setError((e) => e || apiErrorMessage(tRes));
      else setTeam(tRes.json?.data || []);
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
    if (profile && profile.golongan < 5) {
      router.replace('/tech');
      return;
    }
    if (profile) load();
  }, [loading, session, profile, router, load]);

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

  async function reject(task) {
    if (!task.report?.reportId) return;
    const catatanRevisi = window.prompt('Catatan revisi untuk pelaksana:', 'Tolong perbaiki laporannya');
    if (catatanRevisi === null) return;
    setBusyId(task.taskId);
    const res = await apiFetch(token, `/api/tasks/${task.taskId}/reports/${task.report.reportId}/reject`, {
      method: 'POST',
      body: { catatanRevisi },
    });
    if (!res.ok) setError(apiErrorMessage(res));
    setBusyId(null);
    await load();
  }

  const totalPoinTim = team.reduce((s, m) => s + (m.poin || 0), 0);

  return (
    <div className="container">
      <div className="appbar">
        <div className="brand">🔧 Macha Task</div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={() => router.push('/tasks/new')}>+ Buat task</button>
          <button className="link-btn" onClick={() => signOut()}>Keluar</button>
        </div>
      </div>

      <div className="greet-blob">
        <h2>Halo, {profile?.nama || 'Atasan'} 👋</h2>
        <p>Ini antrean approval & performa tim kamu.</p>
      </div>

      <div className="grid-metrics">
        <div className="metric">
          <div className="metric-label">Menunggu approval</div>
          <div className="metric-num">{pending.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Anggota tim</div>
          <div className="metric-num">{team.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Poin tim (bulan ini)</div>
          <div className="metric-num">{totalPoinTim}</div>
        </div>
      </div>

      {error ? <p className="err show">{error}</p> : null}

      <div className="section-title">Antrean approval</div>
      {loadingData ? (
        <p className="muted">Memuat…</p>
      ) : pending.length === 0 ? (
        <div className="empty-state">Belum ada task yang menunggu approval. ✨</div>
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
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-primary" disabled={busyId === t.taskId} onClick={() => approve(t)}>
                ✅ Setujui
              </button>
              <button className="btn btn-danger-outline" disabled={busyId === t.taskId} onClick={() => reject(t)}>
                ↩️ Revisi
              </button>
            </div>
          </div>
        ))
      )}

      <div className="section-title">Statistik tim</div>
      {team.length === 0 ? (
        <div className="empty-state">Belum ada anggota tim. Bawahan akan muncul di sini setelah di-assign ke kamu.</div>
      ) : (
        <div className="card" style={{ padding: 6 }}>
          <table className="tidy">
            <tbody>
              <tr>
                <td>Nama</td>
                <td>Golongan</td>
                <td style={{ textAlign: 'right' }}>Poin</td>
              </tr>
              {team.map((m) => (
                <tr key={m.userId}>
                  <td>{m.nama}</td>
                  <td>{m.golongan}</td>
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
