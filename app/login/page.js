'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';

export default function Login() {
  const { session, profile, loading, signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState('masuk');
  const [form, setForm] = useState({ email: '', password: '', nama: '', nik: '', golongan: '3' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      router.replace(profile && profile.golongan >= 5 ? '/dashboard' : '/tech');
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
        const { error } = await signUp(form.email, form.password, {
          nama: form.nama.trim(),
          nik: form.nik.trim(),
          golongan: Number(form.golongan) || 1,
        });
        if (error) throw new Error(error.message);
        setError('Berhasil mendaftar! Cek email kamu untuk konfirmasi (jika diaktifkan), lalu masuk.');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <div className="phone">
        <div className="phone-inner">
          <div className="brand" style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 20, color: 'var(--teal-dark)', marginBottom: 6 }}>
            Macha Task
          </div>
          <p className="muted" style={{ marginBottom: 18 }}>
            Task tracker tim Production Engineering
          </p>

          <div className="tabbar" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {['masuk', 'daftar'].map((m) => (
              <button
                key={m}
                type="button"
                className="btn"
                onClick={() => setMode(m)}
                style={
                  mode === m
                    ? { background: 'var(--teal)', color: '#fff', borderColor: 'var(--teal)', flex: 1 }
                    : { flex: 1 }
                }
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

                <label className="f-label" style={{ marginTop: 12 }}>NIK (opsional)</label>
                <input className="f-input" value={form.nik} onChange={set('nik')} placeholder="00123456" />

                <label className="f-label" style={{ marginTop: 12 }}>Golongan</label>
                <select className="f-input" value={form.golongan} onChange={set('golongan')}>
                  <option value="1">1 — Operator</option>
                  <option value="2">2 — Technician</option>
                  <option value="3">3 — Technician</option>
                  <option value="4">4 — Technician</option>
                  <option value="5">5 — Supervisor</option>
                  <option value="6">6 — Assistant Manager</option>
                  <option value="7">7 — Section Manager</option>
                </select>
              </>
            )}

            {error ? <p className="err show" style={{ marginTop: 10 }}>{error}</p> : null}

            <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
              {busy ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Daftar'}
            </button>
          </form>

          <div className="stamp-note">
            <span>💡</span>
            <span>Belum punya akun? Pilih tab <b>Daftar</b>. Kamu juga bisa registrasi lewat bot Telegram.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
