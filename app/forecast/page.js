'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IconTrendingUp } from '@tabler/icons-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import AppBar from '@/components/AppBar';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';

const STATUS_BADGE = {
  on_track: { label: 'On track', bg: 'var(--teal-tint)', color: 'var(--teal-dark)' },
  at_risk: { label: 'At risk', bg: 'var(--coral-tint)', color: 'var(--coral-ink)' },
  belum_ada_data: { label: 'Belum ada data', bg: 'var(--sky-tint)', color: 'var(--sky-ink)' },
};

export default function Forecast() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    setLoadingData(true);
    try {
      const res = await apiFetch(token, '/api/forecast');
      if (!res.ok) setError(apiErrorMessage(res));
      else setData(res.json?.data || null);
    } finally {
      setLoadingData(false);
    }
  }, [token]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    load();
  }, [loading, session, router, load]);

  if (loading || !session) return <Loading />;

  const velocity = data?.velocity || [];
  const proyeksi = data?.proyeksi;
  const adaData = velocity.some((v) => v.poin > 0);

  return (
    <div className="container">
      <AppBar />
      <h1 style={{ fontSize: 24, margin: '16px 0' }}>
        <IconTrendingUp size={22} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Forecast
      </h1>

      {error ? <p className="err">{error}</p> : null}
      {loadingData ? (
        <Loading />
      ) : !adaData ? (
        <EmptyState title="Belum cukup data" note="Proyeksi butuh riwayat poin minimal sebulan — terus kumpulkan dulu ya 💪" />
      ) : (
        <>
          <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Proyeksi poin/bulan', val: proyeksi?.poinPerBulan },
              { label: 'Proyeksi task/bulan', val: proyeksi?.taskPerBulan },
              { label: 'Proyeksi poin kuartal', val: proyeksi?.poinKuartal },
              { label: 'Proyeksi task kuartal', val: proyeksi?.taskKuartal },
            ].map((m) => (
              <div key={m.label} className="metric" style={{ background: 'var(--surface-tint)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 26, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{m.val ?? 0}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{m.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Velocity poin per bulan</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={velocity}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                {proyeksi?.poinPerBulan ? (
                  <ReferenceLine y={proyeksi.poinPerBulan} stroke="#F2A93B" strokeDasharray="6 4" label={{ value: 'Rata-rata', fontSize: 11, fill: '#8A5A0B' }} />
                ) : null}
                <Area type="monotone" dataKey="poin" stroke="#2F6F62" fill="#2F6F62" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Status per kategori KPI</h2>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Aktual vs target bobot level kamu (kuartal berjalan).
            </p>
            {(data?.kategoriStatus || []).map((k) => {
              const badge = STATUS_BADGE[k.status] || STATUS_BADGE.belum_ada_data;
              return (
                <div key={k.kategori} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{k.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>
                      {k.aktualPct}% / target {k.targetPct}%
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
