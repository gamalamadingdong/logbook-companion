import { useEffect, useState } from 'react';
import { connectConcept2, developmentConcept2, type DevelopmentConnection } from '../services/concept2Auth';
import { DEVELOPMENT_SYNC_DISABLED } from '../services/concept2Environment';
import { useAuth } from '../hooks/useAuth';

export function DevelopmentConcept2() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<DevelopmentConnection | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    if (user) void developmentConcept2('status').then(data => { if (active) setConnection(data); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [user]);
  async function refresh() {
    setPending(true); setError('');
    try { await developmentConcept2('refresh'); setConnection(await developmentConcept2('status')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Refresh failed.'); }
    finally { setPending(false); }
  }
  return <section className="max-w-xl mx-auto p-6 space-y-4 text-neutral-100">
    <h1 className="text-2xl font-bold">Concept2 development connection</h1>
    <p>{DEVELOPMENT_SYNC_DISABLED} No development workouts are imported or published.</p>
    {!user ? <p>Sign in to Logbook Companion before connecting.</p> : <>
      <p>{connection?.busy ? 'Operation pending. Operator recovery required; do not retry.' :
        connection?.connected ? `Connected to development account ${connection.provider_user_id}.` : 'Not connected to development.'}</p>
      <button className="px-4 py-2 rounded bg-emerald-700 disabled:opacity-50" disabled={pending || connection?.busy}
        onClick={() => void connectConcept2()}>Connect development account</button>
      <button className="ml-3 px-4 py-2 rounded bg-neutral-700 disabled:opacity-50" disabled={!connection?.connected || pending || connection?.busy}
        onClick={() => void refresh()}>Check / refresh connection</button>
    </>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </section>;
}
