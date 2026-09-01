'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IconChartLine } from '@tabler/icons-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, BarChart, Bar, Legend,
} from 'recharts';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { KPI_CATEGORY_LABEL } from '@/lib/points';
import AppBar from '@/components/AppBar';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';

export default function Performance() {
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
      const res = await apiFetch(token, '/api/performance?months=6');
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

  const radarData = (data?.kategori || []).map((k) => ({
    kategori: KPI_CATEGORY_LABEL[k.kategori] || k.kategori,
    Aktual: k.aktualPct,
    'Bobot level': k.bobotPct,
  }));
  const adaPoin = (data?.trend || []).some((t) => t.poin > 0);

  return (
    <div className="container">
      <AppBar />
      <h1 style={{ fontSize: 24, margin: '16px 0' }}>
        <IconChartLine size={22} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Performa
      </h1>

      {error ? <p className="err">{error}</p> : null}
      {loadingData ? (
        <Loading />
      ) : !data || !adaPoin ? (
        <EmptyState title="Belum ada data performa" note="Poin dari task yang di-approve bakal muncul di grafik ini 📈" />
      ) : (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Tren poin 6 bulan terakhir</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trend}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="poin" stroke="#2F6F62" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Distribusi kategori KPI</h2>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Perbandingan poin aktual vs bobot KPI level kamu (dari matriks resmi).
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="kategori" tick={{ fontSize: 11 }} />
                <Radar name="Aktual" dataKey="Aktual" stroke="#2F6F62" fill="#2F6F62" fillOpacity={0.35} />
                <Radar name="Bobot level" dataKey="Bobot level" stroke="#F2A93B" fill="#F2A93B" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {data.perUser.length > 1 ? (
            <div className="card" style={{ padding: 16 }}>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>Poin per anggota (6 bulan)</h2>
              <ResponsiveContainer width="100%" height={Math.max(160, data.perUser.length * 36)}>
                <BarChart data={data.perUser} layout="vertical">
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nama" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="poin" fill="#4F91C7" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
