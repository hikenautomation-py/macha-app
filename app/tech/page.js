'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import TicketCard from '@/components/TicketCard';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { isAtasan } from '@/lib/constants';
import AppBar from '@/components/AppBar';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import { IconCheck, IconAlertTriangle, IconBulb, IconHandGrab } from '@tabler/icons-react';

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'assigned', label: 'Ditugaskan' },
  { key: 'in_progress', label: 'Aktif' },
  { key: 'report_submitted', label: 'Menunggu' },
  { key: 'approved', label: 'Selesai' },
];

const ACTIONABLE = ['assigned', 'in_progress', 'rejected'];

export default function Tech() {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [tasks, setTasks] = useState([]);
  const [externals, setExternals] = useState([]);
  const [poin, setPoin] = useState({ totalPoin: 0, jumlahTaskSelesai: 0 });
  const [filter, setFilter] = useState('all');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!token || !profile) return;
    setError('');
    setLoadingData(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [tRes, pRes, eRes] = await Promise.all([
        apiFetch(token, `/api/tasks?userId=${profile.id}`),
        apiFetch(token, `/api/users/${profile.id}/points?month=${month}`),
        apiFetch(token, '/api/external?status=open'),
      ]);
      if (!tRes.ok) setError(apiErrorMessage(tRes));
      else setTasks(tRes.json?.data || []);
      if (!pRes.ok) setError((e) => e || apiErrorMessage(pRes));
      else setPoin(pRes.json?.data || { totalPoin: 0, jumlahTaskSelesai: 0 });
      if (!eRes.ok) setError((e) => e || apiErrorMessage(eRes));
      else setExternals(eRes.json?.data || []);
    } finally {
      setLoadingData(false);
    }
  }, [token, profile]);

  async function pickUp(item) {
    setBusyId(item.id);
    const res = await apiFetch(token, `/api/external/${item.id}/pickup`, {
      method: 'POST',
      body: {},
    });
    if (!res.ok) setError(apiErrorMessage(res));
    setBusyId(null);
    await load();
  }

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (profile && isAtasan(profile)) {
      router.replace('/dashboard');
      return;
    }
    if (profile) load();
  }, [loading, session, profile, router, load]);

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="container">
      <AppBar actions={<button className="link-btn" onClick={() => signOut()}>Keluar</button>} />

      <div className="greet-blob">
        <h2>Halo, {profile?.nama || 'Tech'}</h2>
        <p>Poin bulan ini: <b className="mono">{poin.totalPoin}</b> · {poin.jumlahTaskSelesai} task selesai</p>
      </div>

      {error ? <p className="err show" role="alert">{error}</p> : null}

      <div className="two-col">
        <div>
          <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className="btn"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingData ? (
            <Loading />
          ) : visible.length === 0 ? (
            <EmptyState>Belum ada task. Santai dulu, atau tanya atasan kamu.</EmptyState>
          ) : (
            visible.map((t) => (
              <TicketCard key={t.taskId} task={t}>
                {ACTIONABLE.includes(t.status) ? (
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn btn-primary" onClick={() => router.push(`/tasks/${t.taskId}/complete`)}>
                      <IconCheck size={16} aria-hidden="true" /> Selesaikan
                    </button>
                    <button className="btn btn-danger-outline" onClick={() => router.push(`/tasks/${t.taskId}/problem`)}>
                      <IconAlertTriangle size={16} aria-hidden="true" /> Lapor masalah
                    </button>
                  </div>
                ) : null}
              </TicketCard>
            ))
          )}
        </div>

        <div className="side">
          <div className="section-title">Laporan umum & request</div>
          {loadingData ? (
            <Loading />
          ) : externals.length === 0 ? (
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
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  disabled={busyId === e.id}
                  onClick={() => pickUp(e)}
                >
                  {busyId === e.id ? 'Mengambil…' : (
                    <><IconHandGrab size={16} aria-hidden="true" /> Pick up</>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
