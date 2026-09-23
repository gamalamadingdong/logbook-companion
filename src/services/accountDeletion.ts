import { supabase } from './supabase';

/**
 * Permanently delete the signed-in athlete's account.
 *
 * The work happens in `public.delete_my_account`, a security-definer routine
 * that derives its subject from `auth.uid()`, so a caller can only ever delete
 * themselves and the client cannot widen the scope. It runs as one transaction,
 * so an account is never left partially deleted.
 *
 * Shared team records are retained with the owning identity cleared. Results
 * already published to a Concept2 logbook live on Concept2's servers and are
 * not ours to remove.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
  // The account no longer exists, so discard the local session rather than
  // leaving a token that can never be refreshed.
  await supabase.auth.signOut().catch(() => undefined);
}
