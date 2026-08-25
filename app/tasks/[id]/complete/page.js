'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';

export default function CompleteTask() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const taskId = params.id;
  const token = session?.access_token;

  const [task, setTask] = useState(null);
  const [catatan, setCatatan] = useState('');
  const [lampiranUrl, setLampiranUrl] = useState('');
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
    if (!catatan.trim()) {
      setError('Ceritakan dulu apa yang sudah dikerjakan ya.');
      return;
    }
    setBusy(true);
    const res = await apiFetch(token, `/api/tasks/${taskId}/reports`, {
      method: 'POST',
      body: { catatan: catatan.trim(), lampiranUrl: lampiranUrl.trim() || null },
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

        <div className="card" style={{ padding: '12px 14px', marginBottom: 16, background: 'var(--teal-tint)', border: 'none' }}>
          <p style={{ fontSize: 12, color: 'var(--teal-dark)', fontWeight: 600 }}>Task</p>
          <p style={{ fontFamily: 'var(--font-head)', fontSize: 15, color: 'var(--teal-dark)' }}>
            {task?.judul || 'Task'}
          </p>
        </div>

        <form className="card" onSubmit={submit}>
          <label className="f-label">Catatan penyelesaian</label>
          <textarea
            className="f-input"
            style={{ minHeight: 100 }}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Sudah diganti bearing, sudah dites jalan normal"
          />

          <label className="f-label" style={{ marginTop: 12 }}>URL foto (opsional)</label>
          <input
            className="f-input"
            value={lampiranUrl}
            onChange={(e) => setLampiranUrl(e.target.value)}
            placeholder="https://.../foto.jpg"
          />

          {error ? <p className="err show">{error}</p> : null}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
            {busy ? 'Mengirim…' : 'Kirim untuk approval'}
          </button>

          <div className="stamp-note">
            <span>✨</span>
            <span>Setelah disetujui atasan, poin otomatis nambah ke skor kamu bulan ini.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
