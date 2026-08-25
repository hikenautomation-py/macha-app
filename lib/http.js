// Helper fetch ke API route internal dengan Supabase JWT (client-side).
// Dipakai halaman dashboard untuk memanggil /api/... dengan header Authorization.

export async function apiFetch(token, path, { method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch {
    return { ok: false, status: 0, json: { success: false, error: { code: 'NETWORK', message: 'Gagal terhubung ke server' } } };
  }

  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

// Ambil pesan error yang ramah dari response API.
export function apiErrorMessage(res) {
  return res?.json?.error?.message || 'Terjadi kesalahan, coba lagi.';
}
