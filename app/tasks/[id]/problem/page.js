'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import PhoneFrame from '@/components/PhoneFrame';
import TaskContextCard from '@/components/TaskContextCard';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import { IconBellRinging } from '@tabler/icons-react';

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
  const [loadingTask, setLoadingTask] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
      <PhoneFrame>
        <button className="back-btn" onClick={() => router.push('/tech')}>← Kembali</button>

        {loadingTask ? (
          <Loading label="Memuat task…" />
        ) : notFound ? (
          <EmptyState>Task tidak ditemukan atau sudah selesai. Cek daftar task kamu di dashboard.</EmptyState>
        ) : (
          <>
            <TaskContextCard judul={task?.judul || 'Task'} tone="coral" />

            <form className="card" onSubmit={submit}>
              <label className="f-label">Seberapa mendesak?</label>
              <div className="urgency-pick" role="radiogroup" aria-label="Tingkat urgensi">
                {URGENSI.map((u) => (
                  <button
                    key={u.key}
                    type="button"
                    role="radio"
                    aria-checked={urgensi === u.key}
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

              {error ? <p className="err show" role="alert">{error}</p> : null}

              <button
                className="btn btn-danger btn-block"
                type="submit"
                disabled={busy}
                style={{ marginTop: 18 }}
              >
                {busy ? 'Mengirim…' : 'Kirim ke atasan'}
              </button>

              <div className="stamp-note coral">
                <IconBellRinging size={16} aria-hidden="true" />
                <span>Atasan langsung dapat notifikasi begitu ini terkirim, nggak perlu nunggu antrian biasa.</span>
              </div>
            </form>
          </>
        )}
      </PhoneFrame>
    </div>
  );
}