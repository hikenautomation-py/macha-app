'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IconTrophy } from '@tabler/icons-react';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import AppBar from '@/components/AppBar';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import { SkeletonList } from '@/components/Skeleton';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [ranking, setRanking] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    setLoadingData(true);
    try {
      const res = await apiFetch(token, `/api/leaderboard?month=${month}`);
      if (!res.ok) setError(apiErrorMessage(res));
      else setRanking(res.json?.data?.ranking || []);
    } finally {
      setLoadingData(false);
    }
  }, [token, month]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    load();
  }, [loading, session, router, load]);

  if (loading || !session) return <Loading />;

  return (
    <div className="container">
      <AppBar />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
        <h1 style={{ fontSize: 24 }}>
          <IconTrophy size={22} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Ranking bulan ini
        </h1>
        <input
          className="f-input"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Pilih bulan"
          style={{ width: 'auto' }}
        />
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loadingData ? (
        <SkeletonList rows={5} />
      ) : ranking.length === 0 ? (
        <EmptyState title="Belum ada poin bulan ini" note="Selesaikan task dan kumpulkan poin — nama kamu bakal nongol di sini 🚀" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tidy" style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td>#</td>
                <td>Nama</td>
                <td>Jabatan</td>
                <td>Badge</td>
                <td style={{ textAlign: 'right' }}>Poin</td>
              </tr>
              {ranking.map((r) => (
                <tr key={r.userId} style={r.userId === profile?.id ? { background: 'var(--teal-tint)' } : undefined}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{MEDALS[r.peringkat - 1] || r.peringkat}</td>
                  <td style={{ fontWeight: 600 }}>{r.nama}</td>
                  <td>{r.title || '—'}</td>
                  <td>
                    {r.badges.map((b) => (
                      <span key={b.code} title={b.nama} aria-label={b.nama} style={{ marginRight: 4 }}>{b.emoji}</span>
                    ))}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.totalPoin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
