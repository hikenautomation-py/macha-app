'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { isAtasan, GOLONGAN_PELAKSANA_MAX, PELAKSANA_TITLE_OPTIONS } from '@/lib/constants';
import { IconTool, IconBulb } from '@tabler/icons-react';

export default function Login() {
  const { session, profile, loading, signIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState('masuk');
  const [form, setForm] = useState({ email: '', password: '', nama: '', npk: '', golongan: '3', title: 'Technician' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      router.replace(isAtasan(profile) ? '/dashboard' : '/tech');
    }
  }, [loading, session, profile, router]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'masuk') {
        const { error } = await signIn(form.email, form.password);
        if (error) throw new Error(error.message);
      } else {
        if (!form.nama.trim()) throw new Error('Nama wajib diisi.');
        // Daftar via server: akun langsung aktif (email terconfirm), tanpa perlu
        // klik link email — karena golongan 1-5 tidak bisa akses internet/email.
        const res = await apiFetch('/api/signup', {
          method: 'POST',
          body: {
            email: form.email,
            password: form.password,
            nama: form.nama,
            npk: form.npk,
            golongan: Number(form.golongan) || 1,
            title: form.title,
          },
        });
        if (!res.ok) throw new Error(apiErrorMessage(res));
        // Akun sudah aktif — langsung masuk.
        const { error: signInErr } = await signIn(form.email, form.password);
        if (signInErr) setError('Terdaftar! Silakan masuk dengan email & password kamu.');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <div className="panel">
              <div className="brand" style={{ fontSize: 20, marginBottom: 6 }}>
                <IconTool size={18} aria-hidden="true" /> Macha Task
              </div>
              <p className="muted" style={{ marginBottom: 18 }}>
                Task tracker tim Production Engineering
              </p>

              <div className="tabbar" role="tablist" aria-label="Masuk atau daftar">
                {['masuk', 'daftar'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    className={`tab ${mode === m ? 'active' : ''}`}
                    onClick={() => setMode(m)}
                  >
                    {m === 'masuk' ? 'Masuk' : 'Daftar'}
                  </button>
                ))}
              </div>

          <form onSubmit={submit}>
            <label className="f-label">Email</label>
            <input className="f-input" type="email" value={form.email} onChange={set('email')} placeholder="nama@perusahaan.com" required />

            <label className="f-label" style={{ marginTop: 12 }}>Password</label>
            <input className="f-input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" minLength={6} required />

            {mode === 'daftar' && (
              <>
                <label className="f-label" style={{ marginTop: 12 }}>Nama lengkap</label>
                <input className="f-input" value={form.nama} onChange={set('nama')} placeholder="Budi Santoso" />

                <label className="f-label" style={{ marginTop: 12 }}>NPK (opsional)</label>
                <input className="f-input" value={form.npk} onChange={set('npk')} placeholder="00123456" />

                <label className="f-label" style={{ marginTop: 12 }}>Golongan</label>
                <select className="f-input" value={form.golongan} onChange={set('golongan')}>
                  {Array.from({ length: GOLONGAN_PELAKSANA_MAX }, (_, i) => i + 1).map((g) => (
                    <option key={g} value={String(g)}>Golongan {g}</option>
                  ))}
                </select>
                <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  Golongan 5–7 serta jabatan SPV/ASM/SM ditetapkan oleh atasan terverifikasi setelah pendaftaran.
                </p>

                <label className="f-label" style={{ marginTop: 12 }}>Jabatan</label>
                <select className="f-input" value={form.title} onChange={set('title')}>
                  {PELAKSANA_TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </>
            )}

            {error ? <p className="err show" style={{ marginTop: 10 }} role="alert">{error}</p> : null}

            <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
              {busy ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Daftar'}
            </button>
          </form>

          <div className="stamp-note">
            <IconBulb size={16} aria-hidden="true" />
            <span>Belum punya akun? Pilih tab <b>Daftar</b>. Sudah punya akun? Ketik <b>/start</b> di bot Telegram dan masukkan NPK untuk menautkan notifikasi ke Telegram.</span>
          </div>
        </div>
      </div>
  );
}
