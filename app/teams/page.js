'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, apiErrorMessage } from '@/lib/http';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { isAtasan } from '@/lib/constants';
import AppBar from '@/components/AppBar';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';

export default function Teams() {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const token = session?.access_token;

  const [teams, setTeams] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [nama, setNama] = useState('');
  const [leadId, setLeadId] = useState('');
  const [busy, setBusy] = useState(false);
  const [memberTeamId, setMemberTeamId] = useState(null);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !profile) return;
    setError('');
    setLoadingData(true);
    try {
      const [tRes, sRes] = await Promise.all([
        apiFetch(token, '/api/teams'),
        apiFetch(token, `/api/teams/${profile.id}/stats`),
      ]);
      if (!tRes.ok) setError(apiErrorMessage(tRes));
      else setTeams(tRes.json?.data || []);
      if (!sRes.ok) setError((e) => e || apiErrorMessage(sRes));
      else setSubordinates(sRes.json?.data || []);
    } finally {
      setLoadingData(false);
    }
  }, [token, profile]);

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
    if (profile) load();
  }, [loading, session, profile, router, load]);

  async function createTeam(e) {
    e.preventDefault();
    setError('');
    if (!nama.trim()) {
      setError('Nama team wajib diisi.');
      return;
    }
    setBusy(true);
    const res = await apiFetch(token, '/api/teams', {
      method: 'POST',
      body: { nama: nama.trim(), leadId: leadId || null },
    });
    setBusy(false);
    if (!res.ok) {
      setError(apiErrorMessage(res));
      return;
    }
    setNama('');
    setLeadId('');
    await load();
  }

  async function syncMembers(teamId) {
    setMemberBusy(true);
    setError('');
    const res = await apiFetch(token, `/api/teams/${teamId}/members`, {
      method: 'POST',
      body: { action: 'sync' },
    });
    setMemberBusy(false);
    if (!res.ok) {
      setError(apiErrorMessage(res));
      return;
    }
    await load();
  }

  async function deleteTeam(teamId) {
    setDeleteBusy(true);
    setError('');
    const res = await apiFetch(token, `/api/teams/${teamId}`, { method: 'DELETE' });
    setDeleteBusy(false);
    if (!res.ok) {
      setError(apiErrorMessage(res));
      return;
    }
    setDeleteTeamId(null);
    await load();
  }

  async function manageMember(teamId, action) {
    if (!memberUserId) {
      setError('Pilih anggota dulu.');
      return;
    }
    setMemberBusy(true);
    setError('');
    const res = await apiFetch(token, `/api/teams/${teamId}/members`, {
      method: 'POST',
      body: { userId: memberUserId, action },
    });
    setMemberBusy(false);
    if (!res.ok) {
      setError(apiErrorMessage(res));
      return;
    }
    setMemberUserId('');
    setMemberTeamId(null);
    await load();
  }

  return (
    <div className="container">
      <AppBar
        actions={
          <>
            <button className="btn btn-primary" onClick={() => router.push('/dashboard')}><IconArrowLeft size={16} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Dashboard</button>
            <button className="link-btn" onClick={() => signOut()}>Keluar</button>
          </>
        }
      />

      <div className="greet-blob">
        <h2>Kelola tim</h2>
        <p>Buat team dan tentukan siapa lead beserta anggotanya.</p>
      </div>

      {error ? <p className="err show" role="alert">{error}</p> : null}

      <form className="card" onSubmit={createTeam}>
        <label className="f-label">Nama team</label>
        <input className="f-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Line 1 / Machining / Assembly" />

        <label className="f-label" style={{ marginTop: 12 }}>Lead team (opsional, default kamu)</label>
        <select className="f-input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
          <option value="">Kamu sendiri</option>
          {subordinates.map((s) => (
            <option key={s.userId} value={s.userId}>{s.nama} ({s.title})</option>
          ))}
        </select>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? 'Membuat…' : 'Buat team'}
        </button>
      </form>

      <div className="section-title">Team kamu</div>
      {loadingData ? (
        <SkeletonList rows={2} />
      ) : teams.length === 0 ? (
        <EmptyState>Belum ada team. Buat team pertama kamu di atas.</EmptyState>
      ) : (
        teams.map((t) => {
          const memberIds = new Set((t.members || []).map((m) => m.user_id));
          const belumMasuk = subordinates.filter((s) => !memberIds.has(s.userId));
          return (
          <div className="card" key={t.id} style={{ marginBottom: 12 }}>
            <div className="t-title">{t.nama}</div>
            <div className="t-meta" style={{ marginTop: 4 }}>
              Anggota: {t.members?.length || 0}
            </div>
            <ul style={{ paddingLeft: 18, margin: '10px 0' }}>
              {(t.members || []).map((m) => (
                <li key={m.user_id} style={{ fontSize: 13 }}>
                  {m.users?.nama || m.user_id}{m.role === 'lead' ? ' (lead)' : ''}
                </li>
              ))}
            </ul>

            {belumMasuk.length > 0 ? (
              <p className="t-meta" style={{ margin: '0 0 10px' }}>
                ⚠ {belumMasuk.length} bawahan kamu belum masuk team ini: {belumMasuk.map((s) => s.nama).join(', ')}.
              </p>
            ) : null}

            {memberTeamId === t.id ? (
              <div style={{ marginTop: 10 }}>
                <label className="f-label">Pilih anggota (bawahan kamu)</label>
                <select className="f-input" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
                  <option value="">— Pilih anggota —</option>
                  {subordinates.map((s) => (
                    <option key={s.userId} value={s.userId}>{s.nama} ({s.title})</option>
                  ))}
                </select>
                <div className="btn-group" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" disabled={memberBusy} onClick={() => manageMember(t.id, 'add')}>Tambah</button>
                  <button className="btn btn-danger-outline" disabled={memberBusy} onClick={() => manageMember(t.id, 'remove')}>Hapus</button>
                  <button className="link-btn" onClick={() => setMemberTeamId(null)}>Batal</button>
                </div>
              </div>
            ) : deleteTeamId === t.id ? (
              <div>
                <p className="t-meta" style={{ margin: '0 0 10px' }}>
                  Hapus team <b>{t.nama}</b>? Anggota akan dilepas dari team ini. Task dan poin mereka tidak ikut terhapus.
                </p>
                <div className="btn-group">
                  <button className="btn btn-danger" disabled={deleteBusy} onClick={() => deleteTeam(t.id)}>
                    {deleteBusy ? 'Menghapus…' : 'Ya, hapus team'}
                  </button>
                  <button className="link-btn" onClick={() => setDeleteTeamId(null)}>Batal</button>
                </div>
              </div>
            ) : (
              <div className="btn-group">
                <button className="btn" onClick={() => setMemberTeamId(t.id)}>Kelola anggota</button>
                {belumMasuk.length > 0 ? (
                  <button className="btn btn-primary" disabled={memberBusy} onClick={() => syncMembers(t.id)}>
                    {memberBusy ? 'Menyinkronkan…' : 'Sinkronkan bawahan'}
                  </button>
                ) : null}
                <button className="btn btn-danger-outline" onClick={() => setDeleteTeamId(t.id)}>
                  <IconTrash size={16} aria-hidden="true" /> Hapus team
                </button>
              </div>
            )}
          </div>
          );
        })
      )}
    </div>
  );
}
