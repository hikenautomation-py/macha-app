import { requireAuth, jsonOk, jsonError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// PATCH /api/users/{id} — Update user profile info (specifically email)
export async function PATCH(req, { params }) {
  const { profile, user: authUser, error } = await requireAuth(req);
  if (error) return error;

  const targetId = params.id;
  if (!targetId) {
    return jsonError(400, 'INVALID_ARGUMENT', 'ID user wajib disediakan.');
  }

  // Security check: simple user can only update their own profile.
  // We can let them change email.
  if (targetId !== profile.id) {
    return jsonError(403, 'PERMISSION_DENIED', 'Kamu hanya bisa memperbarui profilmu sendiri.');
  }

  const body = await req.json().catch(() => ({}));
  const { email } = body;

  if (!email || !String(email).trim().includes('@')) {
    return jsonError(400, 'INVALID_ARGUMENT', 'Email tidak valid.');
  }

  const cleanEmail = String(email).trim().toLowerCase();

  const admin = createAdminClient();

  // Check if email already exists in users (excluding current user)
  const { data: checkedEmail } = await admin
    .from('users')
    .select('id')
    .eq('email', cleanEmail)
    .neq('id', targetId)
    .maybeSingle();

  if (checkedEmail) {
    return jsonError(409, 'ALREADY_EXISTS', 'Email sudah digunakan oleh akun lain.');
  }

  // Update in public.users
  const { error: updateErr } = await admin
    .from('users')
    .update({ email: cleanEmail })
    .eq('id', targetId);

  if (updateErr) {
    return jsonError(500, 'INTERNAL', updateErr.message);
  }

  // Update in auth.users
  try {
    await admin.auth.admin.updateUserById(targetId, {
      email: cleanEmail,
      email_confirm: true, // Auto confirm so they don't get locked out
    });
  } catch (err) {
    // If auth update fails, we still consider the local update database as source of truth
    console.error('Failed to update email in Auth:', err);
  }

  return jsonOk({ id: targetId, email: cleanEmail });
}
