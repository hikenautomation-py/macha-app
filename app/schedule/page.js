'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IconCalendarWeek } from '@tabler/icons-react';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { KPI_CATEGORY_LABEL } from '@/lib/points';
import { TASK_STATUS_LABEL } from '@/lib/constants';
import AppBar from '@/components/AppBar';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import GanttChart from '@/components/GanttChart';

export default function Schedule() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [weeks, setWeeks] = useState(2);
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    setLoadingData(true);
    try {
      const res = await apiFetch(token, `/api/schedule?weeks=${weeks}`);
      if (!res.ok) setError(apiErrorMessage(res));
      else setData(res.json?.data || null);
    } finally {
      setLoadingData(false);
    }
  }, [token, weeks]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    load();
  }, [loading, session, router, load]);

  if (loading || !session) return <Loading />;

  const agenda = data?.agenda || [];
  const beban = data?.beban || [];

  return (
    <div className="container">
      <AppBar />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
        <h1 style={{ fontSize: 24 }}>
          <IconCalendarWeek size={22} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Jadwal
        </h1>
        <select
          className="f-input"
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          aria-label="Jendela minggu"
          style={{ width: 'auto' }}
        >
          <option value={1}>1 minggu</option>
          <option value={2}>2 minggu</option>
          <option value={4}>4 minggu</option>
        </select>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loadingData ? (
        <Loading />
      ) : agenda.length === 0 ? (
        <EmptyState title="Tidak ada task aktif" note="Semua beres — jadwal kosong itu kabar baik ✨" />
      ) : (
        <>
          {beban.length > 1 ? (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, marginBottom: 8 }}>Beban tim saat ini</h2>
              <table className="tidy" style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td>Nama</td>
                    <td style={{ textAlign: 'right' }}>Task aktif</td>
                    <td style={{ textAlign: 'right' }}>Poin berjalan</td>
                    <td style={{ textAlign: 'right' }}>Lewat deadline</td>
                  </tr>
                  {beban.map((b) => (
                    <tr key={b.userId}>
                      <td style={{ fontWeight: 600 }}>{b.nama}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.taskAktif}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.totalPoin}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: b.terlambat ? 'var(--coral-ink)' : undefined }}>
                        {b.terlambat}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              Gantt chart 4 minggu{beban.length > 1 ? ' — semua bawahan' : ''}
            </h2>
            <GanttChart agenda={agenda} multiUser={beban.length > 1} />
          </div>

          <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Agenda deadline</h2>
          {agenda.map((t) => (
            <div key={t.taskId} className="card" style={{ padding: '12px 16px', marginBottom: 8, borderLeft: t.terlambat ? '3px solid var(--coral)' : '3px solid var(--teal)' }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.judul}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    {t.pelaksana} · {TASK_STATUS_LABEL[t.status] || t.status}
                    {t.kategoriKPI ? ` · ${KPI_CATEGORY_LABEL[t.kategoriKPI]}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t.poin} poin</div>
                  <div style={{ fontSize: 12, color: t.terlambat ? 'var(--coral-ink)' : 'var(--ink-soft)' }}>
                    {t.deadline ? (t.terlambat ? `Lewat ${t.deadline}` : t.deadline) : 'Tanpa deadline'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
