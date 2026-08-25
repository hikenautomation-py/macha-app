import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Client untuk browser (Auth di client component). Tidak bisa bypass RLS.
 */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Client server dengan anon key — dipakai untuk verifikasi JWT (auth.getUser).
 */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client admin (service role, BYPASS RLS). HANYA dipakai di route handlers /
 * server. Jangan pernah diekspos ke client.
 */
export function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Verifikasi Supabase JWT, kembalikan user atau null.
 */
export async function verifyToken(token) {
  if (!token) return null;
  const client = createServerClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
