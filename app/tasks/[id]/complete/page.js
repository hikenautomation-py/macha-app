'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import PhoneFrame from '@/components/PhoneFrame';
import TaskContextCard from '@/components/TaskContextCard';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import { IconSparkles } from '@tabler/icons-react';

export default function CompleteTask() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const taskId = params.id;
  const token = session?.access_token;

  const [task, setTask] = useState(null);
  const [loadingTask, setLoadingTask] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
        setLoadingTask(false);
        if (!res.ok) {
          setError(apiErrorMessage(res));
          return;
        }
        const found = (res.json?.data || []).find((t) => t.taskId === taskId);
        if (found) setTask(found);
        else setNotFound(true);
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
      <PhoneFrame>
        <button className="back-btn" onClick={() => router.push('/tech')}>← Kembali</button>

        {loadingTask ? (
          <Loading label="Memuat task…" />
        ) : notFound ? (
          <EmptyState>Task tidak ditemukan atau sudah selesai. Cek daftar task kamu di dashboard.</EmptyState>
        ) : (
          <>
            <TaskContextCard judul={task?.judul || 'Task'} tone="teal" />

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

              {error ? <p className="err show" role="alert">{error}</p> : null}

              <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
                {busy ? 'Mengirim…' : 'Kirim untuk approval'}
              </button>

              <div className="stamp-note">
                <IconSparkles size={16} aria-hidden="true" />
                <span>Setelah disetujui atasan, poin otomatis nambah ke skor kamu bulan ini.</span>
              </div>
            </form>
          </>
        )}
      </PhoneFrame>
    </div>
  );
}