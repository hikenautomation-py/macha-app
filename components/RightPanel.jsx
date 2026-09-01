'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconTrophy, IconCalendarWeek } from '@tabler/icons-react';
import { useAuth } from '@/components/AuthContext';
import { apiFetch } from '@/lib/http';

// Panel kanan (>= 1200px, rasio 20% sesuai mockup dashboard):
// ringkasan ranking bulan ini + agenda deadline terdekat. Data nyata dari
// /api/leaderboard dan /api/schedule — panel disembunyikan via CSS di layar sempit.
export default function RightPanel() {
  const { session, profile } = useAuth();
  const token = session?.access_token;
  const [ranking, setRanking] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token || !profile) return;
    let alive = true;
    (async () => {
      const [lb, sc] = await Promise.all([
        apiFetch(token, '/api/leaderboard'),
        apiFetch(token, '/api/schedule?weeks=2'),
      ]);
      if (!alive) return;
      if (lb.ok) setRanking((lb.json?.data?.ranking || []).slice(0, 5));
      if (sc.ok) {
        setAgenda((sc.json?.data?.agenda || []).filter((a) => a.deadline).slice(0, 5));
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [token, profile]);

  if (!profile) return null;

  return (
    <aside className="rightpanel" aria-label="Ringkasan samping">
      <div className="rp-section">
        <div className="rp-title">
          <IconTrophy size={15} aria-hidden="true" /> Top poin bulan ini
        </div>
        {!loaded ? (
          <p className="muted">Memuat…</p>
        ) : ranking.length === 0 ? (
          <p className="muted">Belum ada poin bulan ini.</p>
        ) : (
          ranking.map((r) => (
            <div className="rp-item" key={r.userId}>
              <span className="rp-rank">{r.peringkat}</span>
              <span className="rp-name">{r.nama}</span>
              <span className="rp-val mono">{r.totalPoin}</span>
            </div>
          ))
        )}
        <Link href="/leaderboard" className="rp-more">Lihat semua →</Link>
      </div>

      <div className="rp-section">
        <div className="rp-title">
          <IconCalendarWeek size={15} aria-hidden="true" /> Deadline terdekat
        </div>
        {!loaded ? (
          <p className="muted">Memuat…</p>
        ) : agenda.length === 0 ? (
          <p className="muted">Tidak ada deadline 2 minggu ke depan.</p>
        ) : (
          agenda.map((a) => (
            <div className="rp-item" key={a.taskId}>
              <span className={`rp-dot${a.terlambat ? ' late' : ''}`} aria-hidden="true" />
              <span className="rp-name" title={a.judul}>{a.judul}</span>
              <span className="rp-val">{a.deadline?.slice(5)}</span>
            </div>
          ))
        )}
        <Link href="/schedule" className="rp-more">Lihat jadwal →</Link>
      </div>
    </aside>
  );
}
