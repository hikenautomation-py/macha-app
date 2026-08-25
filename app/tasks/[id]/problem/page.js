'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';

const URGENSI = [
  { key: 'bisa_nunggu', label: 'Bisa nunggu', cls: 'picked-low' },
  { key: 'perlu_hari_ini', label: 'Perlu hari ini', cls: 'picked-mid' },
  { key: 'mendesak', label: 'Mendesak', cls: 'picked-high' },
];

export default function ProblemTask() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const taskId = params.id;
  const token = session?.access_token;

  const [task, setTask] = useState(null);
  const [urgensi, setUrgensi] = useState('perlu_hari_ini');
  const [deskripsi, setDeskripsi] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (token && profile) {
      apiFetch(token, `/api/tasks?userId=${profile.id}`).then((res) => {
        if (res.ok) {
          const found = (res.json?.data || []).find((t) => t.taskId === taskId);
          setTask(found || null);
        }
      });
    }
  }, [loading, session, profile, token, taskId, router]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!deskripsi.trim()) {
      setError('Ceritain dulu masalahnya ya, biar atasan bisa bantu cepat.');
      return;
    }
    setBusy(true);
    const res = await apiFetch(token, `/api/tasks/${taskId}/problems`, {
      method: 'POST',
      body: { urgensi, deskripsiMasalah: deskripsi.trim() },
    });
    if (!res.ok) {
      setError(apiErrorMessage(res));
      setBusy(false);
      return;
    }
    router.push('/tech');
  }

  return (
    <div className="container">
      <div className="narrow" style={{ maxWidth: 420, padding: 0 }}>
        <button className="back-btn" onClick={() => router.push('/tech')}>← Kembali</button>

        <div className="card" style={{ padding: '12px 14px', marginBottom: 16, background: 'var(--coral-tint)', border: 'none' }}>
          <p style={{ fontSize: 12, color: 'var(--coral-ink)', fontWeight: 600 }}>Task</p>
          <p style={{ fontFamily: 'var(--font-head)', fontSize: 15, color: 'var(--coral-ink)' }}>
            {task?.judul || 'Task'}
          </p>
        </div>

        <form className="card" onSubmit={submit}>
          <label className="f-label">Seberapa mendesak?</label>
          <div className="urgency-pick">
            {URGENSI.map((u) => (
              <button
                key={u.key}
                type="button"
                className={`urgency-opt ${urgensi === u.key ? u.cls : ''}`}
                onClick={() => setUrgensi(u.key)}
              >
                {u.label}
              </button>
            ))}
          </div>

          <label className="f-label" style={{ marginTop: 14 }}>Apa masalahnya?</label>
          <textarea
            className="f-input"
            style={{ minHeight: 90 }}
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder="Jelaskan kendala yang ditemui"
          />

          {error ? <p className="err show">{error}</p> : null}

          <button
            className="btn btn-block"
            type="submit"
            disabled={busy}
            style={{ marginTop: 18, background: 'var(--coral)', color: '#fff', borderColor: 'var(--coral)' }}
          >
            {busy ? 'Mengirim…' : 'Kirim ke atasan'}
          </button>

          <div className="stamp-note coral">
            <span>🔔</span>
            <span>Atasan langsung dapat notifikasi begitu ini terkirim, nggak perlu nunggu antrian biasa.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
