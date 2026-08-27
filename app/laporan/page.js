'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, apiErrorMessage } from '@/lib/http';

export default function LaporanPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nama: '', npk: '', deskripsi: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.nama.trim() || !form.deskripsi.trim()) {
      setError('Nama dan deskripsi wajib diisi.');
      return;
    }
    setBusy(true);
    const res = await apiFetch(null, '/api/external', {
      method: 'POST',
      body: { type: 'problem', nama: form.nama.trim(), npk: form.npk.trim(), deskripsi: form.deskripsi.trim() },
    });
    setBusy(false);
    if (!res.ok) {
      setError(apiErrorMessage(res));
      return;
    }
    setDone(true);
  }

  return (
    <div className="narrow">
      <div className="phone">
        <div className="phone-inner">
          <button className="back-btn" onClick={() => router.push('/')}>← Beranda</button>
          <div className="brand" style={{ fontSize: 18, marginBottom: 8 }}>
            <span aria-hidden="true">🔧</span> Macha Task
          </div>
          <p className="muted" style={{ marginBottom: 16 }}>Laporan masalah umum untuk tim Production Engineering</p>

          {done ? (
            <div className="stamp-note">
              <span aria-hidden="true">✅</span>
              <span>Laporan kamu sudah diterima. Tim engineering akan meninjaunya.</span>
            </div>
          ) : (
            <form className="card" onSubmit={submit}>
              <label className="f-label">Nama lengkap</label>
              <input className="f-input" value={form.nama} onChange={set('nama')} placeholder="Nama kamu" />

              <label className="f-label" style={{ marginTop: 12 }}>NPK (opsional)</label>
              <input className="f-input" value={form.npk} onChange={set('npk')} placeholder="00123456" />

              <label className="f-label" style={{ marginTop: 12 }}>Deskripsi masalah</label>
              <textarea
                className="f-input"
                style={{ minHeight: 110 }}
                value={form.deskripsi}
                onChange={set('deskripsi')}
                placeholder="Jelaskan masalah yang ingin dilaporkan"
              />

              {error ? <p className="err show" role="alert">{error}</p> : null}

              <button className="btn btn-danger btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
                {busy ? 'Mengirim…' : 'Kirim laporan masalah'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
