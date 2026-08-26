'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { isAtasan } from '@/lib/constants';

export default function NewTask() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [team, setTeam] = useState([]);
  const [form, setForm] = useState({ judul: '', deskripsi: '', ditugaskanKe: '', bobotPoin: '5', deadline: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (profile && !isAtasan(profile)) {
      router.replace('/tech');
      return;
    }
    if (token && profile) {
      apiFetch(token, `/api/teams/${profile.id}/stats`).then((res) => {
        if (res.ok) setTeam(res.json?.data || []);
      });
    }
  }, [loading, session, profile, token, router]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.judul.trim()) {
      setError('Judul wajib diisi.');
      return;
    }
    if (!form.ditugaskanKe) {
      setError('Pilih dulu siapa yang mengerjakan.');
      return;
    }
    setBusy(true);
    const res = await apiFetch(token, '/api/tasks', {
      method: 'POST',
      body: {
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim(),
        ditugaskanKe: form.ditugaskanKe,
        bobotPoin: Number(form.bobotPoin) || 0,
        deadline: form.deadline || null,
      },
    });
    if (!res.ok) {
      setError(apiErrorMessage(res));
      setBusy(false);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div className="container">
      <button className="back-btn" onClick={() => router.push('/dashboard')}>← Kembali</button>
      <h2 style={{ marginBottom: 16 }}>Buat task baru</h2>

      <form className="card" onSubmit={submit}>
        <label className="f-label">Judul task</label>
        <input className="f-input" value={form.judul} onChange={set('judul')} placeholder="Perbaikan mesin CNC-04" />

        <label className="f-label" style={{ marginTop: 12 }}>Deskripsi (opsional)</label>
        <textarea className="f-input" style={{ minHeight: 80 }} value={form.deskripsi} onChange={set('deskripsi')} placeholder="Cek kalibrasi axis Z, ganti spindle bearing" />

        <label className="f-label" style={{ marginTop: 12 }}>Ditugaskan ke</label>
        <select className="f-input" value={form.ditugaskanKe} onChange={set('ditugaskanKe')}>
          <option value="">— Pilih anggota tim —</option>
          {team.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.nama} ({m.title})
            </option>
          ))}
        </select>

        <div className="row" style={{ marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="f-label">Bobot poin</label>
            <input className="f-input" type="number" min="0" value={form.bobotPoin} onChange={set('bobotPoin')} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="f-label">Deadline</label>
            <input className="f-input" type="date" value={form.deadline} onChange={set('deadline')} />
          </div>
        </div>

        {error ? <p className="err show">{error}</p> : null}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? 'Mengirim…' : 'Buat task'}
        </button>
      </form>
    </div>
  );
}
