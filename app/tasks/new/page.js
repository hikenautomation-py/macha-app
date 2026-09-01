'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { IconArrowLeft } from '@tabler/icons-react';
import { isAtasan, URGENCY_OPTIONS, URGENCY_LABEL } from '@/lib/constants';
import { KPI_CATEGORIES, KPI_CATEGORY_LABEL, hitungPoin } from '@/lib/points';

export default function NewTask() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [team, setTeam] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState('');
  const [form, setForm] = useState({ judul: '', deskripsi: '', ditugaskanKe: '', bobotPoin: '5', deadline: '', kategoriKPI: '', urgensi: 'bisa_nunggu' });
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
        setLoadingTeam(false);
        if (!res.ok) {
          setTeamError(apiErrorMessage(res));
          return;
        }
        setTeam(res.json?.data || []);
      });
    }
  }, [loading, session, profile, token, router]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Preview poin otomatis saat kategori KPI dipilih.
  const targetMember = team.find((m) => m.userId === form.ditugaskanKe);
  const previewPoin = form.kategoriKPI
    ? hitungPoin({ kategoriKPI: form.kategoriKPI, golongan: targetMember?.golongan, urgensi: form.urgensi })
    : null;

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
        kategoriKPI: form.kategoriKPI || null,
        urgensi: form.urgensi,
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
      <button className="back-btn" onClick={() => router.push('/dashboard')}><IconArrowLeft size={16} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Kembali</button>
      <h2 style={{ marginBottom: 16 }}>Buat task baru</h2>

      <form className="card" onSubmit={submit}>
        <label className="f-label">Judul task</label>
        <input className="f-input" value={form.judul} onChange={set('judul')} placeholder="Perbaikan mesin CNC-04" />

        <label className="f-label" style={{ marginTop: 12 }}>Deskripsi (opsional)</label>
        <textarea className="f-input" style={{ minHeight: 80 }} value={form.deskripsi} onChange={set('deskripsi')} placeholder="Cek kalibrasi axis Z, ganti spindle bearing" />

        <label className="f-label" style={{ marginTop: 12 }}>Ditugaskan ke</label>
        {loadingTeam ? (
          <p className="muted">Memuat anggota tim…</p>
        ) : teamError ? (
          <p className="muted" role="alert">{teamError}. Coba buka kembali halaman ini.</p>
        ) : (
          <select className="f-input" value={form.ditugaskanKe} onChange={set('ditugaskanKe')}>
            <option value="">{team.length === 0 ? 'Belum ada anggota tim' : '— Pilih anggota tim —'}</option>
            {team.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.nama} ({m.title})
              </option>
            ))}
          </select>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="f-label">Kategori KPI</label>
            <select className="f-input" value={form.kategoriKPI} onChange={set('kategoriKPI')}>
              <option value="">— Tanpa kategori (poin manual) —</option>
              {KPI_CATEGORIES.map((c) => (
                <option key={c} value={c}>{KPI_CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="f-label">Urgensi</label>
            <select className="f-input" value={form.urgensi} onChange={set('urgensi')}>
              {URGENCY_OPTIONS.map((u) => (
                <option key={u} value={u}>{URGENCY_LABEL[u]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="f-label">Bobot poin</label>
            {form.kategoriKPI ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 20, margin: '6px 0 0' }} aria-live="polite">
                {previewPoin} poin <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-soft)' }}>(otomatis dari bobot KPI)</span>
              </p>
            ) : (
              <input className="f-input" type="number" min="0" value={form.bobotPoin} onChange={set('bobotPoin')} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label className="f-label">Deadline</label>
            <input className="f-input" type="date" value={form.deadline} onChange={set('deadline')} />
          </div>
        </div>

        {error ? <p className="err show" role="alert">{error}</p> : null}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? 'Mengirim…' : 'Buat task'}
        </button>
      </form>
    </div>
  );
}
