'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import TicketCard from '@/components/TicketCard';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { isAtasan } from '@/lib/constants';
import PhoneFrame from '@/components/PhoneFrame';
import AppBar from '@/components/AppBar';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';

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
  const [poin, setPoin] = useState({ totalPoin: 0, jumlahTaskSelesai: 0 });
  const [filter, setFilter] = useState('all');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !profile) return;
    setError('');
    setLoadingData(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const [tRes, pRes] = await Promise.all([
        apiFetch(token, `/api/tasks?userId=${profile.id}`),
        apiFetch(token, `/api/users/${profile.id}/points?month=${month}`),
      ]);
      if (!tRes.ok) setError(apiErrorMessage(tRes));
      else setTasks(tRes.json?.data || []);
      if (!pRes.ok) setError((e) => e || apiErrorMessage(pRes));
      else setPoin(pRes.json?.data || { totalPoin: 0, jumlahTaskSelesai: 0 });
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
    if (profile && isAtasan(profile)) {
      router.replace('/dashboard');
      return;
    }
    if (profile) load();
  }, [loading, session, profile, router, load]);

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="container">
      <PhoneFrame>
        <AppBar actions={<button className="link-btn" onClick={() => signOut()}>Keluar</button>} />

        <div className="greet-blob">
          <h2>Halo, {profile?.nama || 'Tech'} 👋</h2>
          <p>Poin bulan ini: <b className="mono">{poin.totalPoin}</b> · {poin.jumlahTaskSelesai} task selesai</p>
        </div>

        {error ? <p className="err show" role="alert">{error}</p> : null}

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
          <EmptyState>Belum ada task. Santai dulu, atau tanya atasan kamu. 🙂</EmptyState>
        ) : (
          visible.map((t) => (
            <TicketCard key={t.taskId} task={t}>
              {ACTIONABLE.includes(t.status) ? (
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={() => router.push(`/tasks/${t.taskId}/complete`)}>
                    <span aria-hidden="true">✔</span> Selesaikan
                  </button>
                  <button className="btn btn-danger-outline" onClick={() => router.push(`/tasks/${t.taskId}/problem`)}>
                    <span aria-hidden="true">🚨</span> Lapor masalah
                  </button>
                </div>
              ) : null}
            </TicketCard>
          ))
        )}
      </PhoneFrame>
    </div>
  );
}
