'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import AppBar from '@/components/AppBar';
import { userTitle } from '@/lib/constants';
import Loading from '@/components/Loading';

export default function ProfilePage() {
  const { session, profile, loading, supabase } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Synchronize initial input once profile becomes available
  useEffect(() => {
    if (profile?.email) {
      setEmailInput(profile.email);
    }
  }, [profile]);

  // Nama tim user (dari team_members) — supaya user tahu dia ada di tim apa.
  useEffect(() => {
    const token = session?.access_token;
    if (!token || !profile?.id) return;
    let alive = true;
    (async () => {
      const res = await apiFetch(token, `/api/users/${profile.id}/teams`);
      if (!alive) return;
      if (res.ok) setTeams(res.json?.data || []);
      setLoadingTeams(false);
    })();
    return () => {
      alive = false;
    };
  }, [session, profile]);

  if (loading) return <Loading />;

  if (!session || !profile) {
    return (
      <div className="container">
        <AppBar />
        <div className="card" style={{ marginTop: 20 }}>
          <p className="err_msg" style={{ color: 'var(--coral)' }}>Kamu belum masuk atau session kamu kedaluwarsa. Silakan login kembali.</p>
        </div>
      </div>
    );
  }

  async function updateProfile(e) {
    e.preventDefault();
    setBusy(true);
    setSuccessMsg('');
    setErrMsg('');

    try {
      const token = session?.access_token;
      const res = await apiFetch(token, `/api/users/${profile.id}`, {
        method: 'PATCH',
        body: { email: emailInput.trim() },
      });

      if (!res.ok) {
        throw new Error(apiErrorMessage(res));
      }

      setSuccessMsg('Email berhasil diperbarui!');
      
      // Force refreshing AuthContext/Supabase Session profile state
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', profile.id)
        .maybeSingle();
      if (data) {
        // Since useAuth profile listens to state, updating locally or reloading page will sync it.
        // We can reload to verify fully.
        window.location.reload();
      }
    } catch (err) {
      setErrMsg(err.message || 'Gagal memperbarui profil.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <AppBar />
      <div style={{ marginTop: 16 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Profil Member</h1>
        
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ marginBottom: 16 }}>
            <span className="badge" style={{ background: 'var(--teal)', color: '#fff', fontSize: 12, padding: '4px 8px', borderRadius: 4 }}>
              {userTitle(profile)}
            </span>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label className="f-label" style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>Nama</label>
              <div style={{ fontSize: 16, fontWeight: 500, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                {profile.nama}
              </div>
            </div>

            <div>
              <label className="f-label" style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>NPK</label>
              <div style={{ fontSize: 15, fontFamily: 'var(--font-mono)', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                {profile.npk || '—'}
              </div>
            </div>

            <div>
              <label className="f-label" style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>Tim</label>
              <div style={{ fontSize: 15, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                {loadingTeams
                  ? 'Memuat…'
                  : teams.length === 0
                    ? 'Belum tergabung di tim mana pun'
                    : teams.map((t) => `${t.nama}${t.role === 'lead' ? ' (lead)' : ''}`).join(', ')}
              </div>
            </div>

            <div>
              <label className="f-label" style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>Golongan</label>
              <div style={{ fontSize: 15, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                Golongan {profile.golongan}
              </div>
            </div>

            <form onSubmit={updateProfile} style={{ marginTop: 8 }}>
              <label className="f-label" htmlFor="email-input" style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>Email</label>
              <input
                id="email-input"
                className="f-input"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@perusahaan.com"
                required
                disabled={busy}
              />
              
              {successMsg && <p style={{ color: 'var(--teal-dark)', marginTop: 8, fontSize: 13, fontWeight: 600 }}>{successMsg}</p>}
              {errMsg && <p className="err show" style={{ marginTop: 8, fontSize: 13 }}>{errMsg}</p>}

              <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>
                {busy ? 'Menyimpan…' : 'Simpan Email'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
