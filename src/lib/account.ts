import { supabase } from './supabase';

/**
 * Permanently deletes the signed-in account through the delete-account Edge Function, which checks
 * the password again, cancels a live Pro subscription, and removes every note and file.
 */
export async function deleteAccount(password: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  }).catch(() => {
    throw new Error('Couldn’t reach the server. Check your connection and try again.');
  });
  const body = (await res.json().catch(() => null)) as { deleted?: boolean; error?: string } | null;
  if (!res.ok || !body?.deleted) {
    throw new Error(
      body?.error ?? (res.status === 404 ? 'Account deletion isn’t deployed yet (see README).' : 'Couldn’t delete your account.'),
    );
  }
  // The session belongs to a user that no longer exists: clear it on this device.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
