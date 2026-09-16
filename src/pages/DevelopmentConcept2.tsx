import { useEffect, useState } from 'react';
import { connectConcept2, developmentConcept2, type DevelopmentConnection, type DevelopmentResult } from '../services/concept2Auth';
import { useAuth } from '../hooks/useAuth';

export function DevelopmentConcept2() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<DevelopmentConnection | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<DevelopmentResult[]>([]);
  const [total, setTotal] = useState(0);
  const [viewPage, setViewPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (user) void developmentConcept2('status').then(async data => {
      if (!active) return;
      setConnection(data);
      if (data.connected) {
        const saved = await developmentConcept2('results');
        if (active) { setResults(saved.results ?? []); setTotal(saved.total ?? 0); }
      }
    }).catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);
  async function refresh() {
    setPending(true); setError('');
    try { await developmentConcept2('refresh'); setConnection(await developmentConcept2('status')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Refresh failed.'); }
    finally { setPending(false); }
  }
  async function loadPage(page: number) {
    const saved = await developmentConcept2('results', { page });
    setResults(saved.results ?? []); setTotal(saved.total ?? 0); setViewPage(page);
  }
  async function importPage(page: number) {
    setPending(true); setError(''); setMessage('');
    try {
      await developmentConcept2('refresh');
      const saved = await developmentConcept2('sync', { page });
      setNextPage(saved.next_page ?? null);
      setMessage(`Saved ${saved.imported ?? 0} results from development page ${page}. Re-importing updates existing records without duplicates.`);
      await loadPage(1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Import failed. Retry the same page.'); }
    finally {
      try { setConnection(await developmentConcept2('status')); } catch { /* Original error remains visible. */ }
      setPending(false);
    }
  }
  async function browse(page: number) {
    setPending(true); setError('');
    try { await loadPage(page); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load saved results.'); }
    finally { setPending(false); }
  }
  return <section className="max-w-xl mx-auto p-6 space-y-4 text-neutral-100">
    <h1 className="text-2xl font-bold">Concept2 development connection</h1>
    <p>Manual development imports are stored separately. They do not change production history, analytics, or assignments. Publishing is disabled.</p>
    {!user ? <p>Sign in to Logbook Companion before connecting.</p> : <>
      <p role="status">{loading ? 'Checking development connection…' : connection?.busy ? 'Operation pending. Operator recovery required; do not retry.' :
        connection?.connected ? `Connected to development account ${connection.provider_user_id}.` : 'Not connected to development.'}</p>
      <button className="px-4 min-h-11 rounded bg-emerald-700 disabled:opacity-50" disabled={loading || pending || connection?.busy}
        onClick={() => void connectConcept2()}>Connect development account</button>
      <button className="ml-3 px-4 min-h-11 rounded bg-neutral-700 disabled:opacity-50" disabled={!connection?.connected || pending || connection?.busy}
        onClick={() => void refresh()}>Check / refresh connection</button>
      <div className="flex flex-wrap gap-3">
        <button className="min-h-11 px-4 rounded bg-emerald-700 disabled:opacity-50" disabled={!connection?.connected || pending || connection?.busy}
          onClick={() => void importPage(1)}>Import / recheck first page</button>
        {nextPage !== null && nextPage > 1 && <button className="min-h-11 px-4 rounded bg-neutral-700 disabled:opacity-50"
          disabled={!connection?.connected || pending || connection?.busy} onClick={() => void importPage(nextPage)}>Import next page ({nextPage})</button>}
      </div>
      <p role="status">{pending ? 'Working…' : message}</p>
      <h2 className="text-lg font-semibold">Saved development results ({total})</h2>
      {!loading && !results.length && <p>No saved development results. Import a page after connecting; an empty Concept2 development account will return zero results.</p>}
      <ul className="space-y-3">{results.map(result => <li key={result.id} className="rounded border border-neutral-700 p-3">
        <p>{result.date} · {result.type}</p>
        <p>{result.distance} m · {result.time / 10} seconds · Result {result.id}</p>
      </li>)}</ul>
      <div className="flex gap-3">
        <button className="min-h-11 px-3 disabled:opacity-50" disabled={pending || viewPage === 1} onClick={() => void browse(viewPage - 1)}>Previous saved page</button>
        <button className="min-h-11 px-3 disabled:opacity-50" disabled={pending || viewPage * 25 >= total} onClick={() => void browse(viewPage + 1)}>Next saved page</button>
      </div>
    </>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </section>;
}
