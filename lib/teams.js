/**
 * Ambil daftar team yang diikuti seorang user (lewat tabel `team_members`).
 * Aman dipanggil tanpa data (return [] bila query gagal).
 * @returns {Promise<Array<{id: string, nama: string, role: string}>>}
 */
export async function getUserTeams(admin, userId) {
  if (!admin || !userId) return [];
  const { data, error } = await admin
    .from('team_members')
    .select('role, teams(id, nama)')
    .eq('user_id', userId);
  if (error) return [];
  return (data || [])
    .filter((r) => r.teams)
    .map((r) => ({ id: r.teams.id, nama: r.teams.nama, role: r.role }));
}

/**
 * Id semua rekan satu team dengan user (termasuk dirinya sendiri).
 * Dipakai untuk membatasi ranking supaya user hanya melihat anggota timnya —
 * user tanpa team hanya melihat dirinya sendiri.
 */
export async function getTeammateIds(admin, userId) {
  const teams = await getUserTeams(admin, userId);
  const ids = new Set([userId]);
  if (!teams.length) return [...ids];
  const { data } = await admin
    .from('team_members')
    .select('user_id')
    .in('team_id', teams.map((t) => t.id));
  for (const r of data || []) ids.add(r.user_id);
  return [...ids];
}
