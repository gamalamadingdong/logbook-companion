import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bug, CheckCircle2, Copy, RefreshCcw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardHeader } from '../components/ui';
import {
  appDiagnosticsEnabled,
  clearDiagnosticEvents,
  diagnosticBuildInfo,
  readDiagnosticEvents,
  subscribeToDiagnostics,
  type DiagnosticEvent,
} from '../services/appDiagnostics';
import { getMobileUpdateDiagnostics, type MobileUpdateDiagnostics } from '../services/mobileUpdates';

function eventTone(level: DiagnosticEvent['level']): 'danger' | 'warning' | 'info' {
  if (level === 'error') return 'danger';
  if (level === 'warning') return 'warning';
  return 'info';
}

function buildReport(snapshot: MobileUpdateDiagnostics | null, events: DiagnosticEvent[]): string {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    build: diagnosticBuildInfo(),
    ota: snapshot,
    events,
  }, null, 2);
}

export function Diagnostics() {
  const [events, setEvents] = useState(() => readDiagnosticEvents());
  const [snapshot, setSnapshot] = useState<MobileUpdateDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setEvents(readDiagnosticEvents());
    setSnapshot(await getMobileUpdateDiagnostics());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    return subscribeToDiagnostics(() => setEvents(readDiagnosticEvents()));
  }, []);

  const report = useMemo(() => buildReport(snapshot, events), [events, snapshot]);

  if (!appDiagnosticsEnabled) {
    return <Card><CardHeader title="Diagnostics unavailable" subtitle="This surface is enabled only in staging and mobile development builds." /></Card>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-accent-primary"><Bug size={20} /><span className="text-xs font-semibold uppercase tracking-wider">Staging diagnostics</span></div>
          <h1 className="mt-2 text-2xl font-semibold text-content-primary sm:text-3xl">App and update status</h1>
          <p className="mt-1 text-sm text-content-secondary">Safe bundle identity, update state, slow requests, and error codes. No tokens or device IDs are recorded.</p>
        </div>
        <Button type="button" variant="secondary" className="min-h-11" loading={loading} icon={<RefreshCcw size={16} />} onClick={() => void refresh()}>Refresh</Button>
      </div>

      <Card>
        <CardHeader title="Bundle identity" subtitle="This tells us whether TestFlight is running its built-in JavaScript or an OTA bundle." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-surface-secondary p-3"><p className="text-xs text-content-muted">JS build</p><p className="mt-1 break-all text-sm font-medium text-content-primary">{snapshot?.build ?? diagnosticBuildInfo().build}</p></div>
          <div className="rounded-lg bg-surface-secondary p-3"><p className="text-xs text-content-muted">Build mode</p><p className="mt-1 text-sm font-medium text-content-primary">{snapshot?.mode ?? diagnosticBuildInfo().mode}</p></div>
          <div className="rounded-lg bg-surface-secondary p-3"><p className="text-xs text-content-muted">Active source</p><p className="mt-1 text-sm font-medium text-content-primary">{snapshot?.currentBundle?.source ?? (snapshot?.native ? 'unknown' : 'web')}</p></div>
          <div className="rounded-lg bg-surface-secondary p-3"><p className="text-xs text-content-muted">Active version</p><p className="mt-1 text-sm font-medium text-content-primary">{snapshot?.currentBundle?.version ?? '—'}</p></div>
        </div>
      </Card>

      <Card>
        <CardHeader title="OTA check" subtitle="The halted beta channel should report blocked / channel_halted and no pending bundle." />
        <div className="flex flex-wrap gap-2">
          <Badge variant={snapshot?.updateCheck?.kind === 'failed' ? 'danger' : snapshot?.updateCheck?.kind === 'blocked' ? 'warning' : 'info'}>{snapshot?.updateCheck?.kind ?? 'not checked'}</Badge>
          {snapshot?.updateCheck?.error && <Badge variant="muted">{snapshot.updateCheck.error}</Badge>}
          {snapshot?.pendingBundle && <Badge variant="warning">Pending {snapshot.pendingBundle.version}</Badge>}
          {snapshot?.errors.map((code) => <Badge key={code} variant="danger">{code}</Badge>)}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-content-muted">Native version</dt><dd className="mt-1 text-content-primary">{snapshot?.nativeVersion ?? '—'}</dd></div>
          <div><dt className="text-content-muted">Plugin</dt><dd className="mt-1 text-content-primary">{snapshot?.pluginVersion ?? '—'}</dd></div>
          <div><dt className="text-content-muted">Downloaded</dt><dd className="mt-1 text-content-primary">{snapshot?.downloadedBundles.length ?? 0}</dd></div>
          <div><dt className="text-content-muted">Platform</dt><dd className="mt-1 text-content-primary">{snapshot?.native ? 'native' : 'web'}</dd></div>
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Recent diagnostic events"
          subtitle="Slow Supabase calls appear after 1 second. Training Block reports TB_LOAD_SLOW after 4 seconds."
          action={<Button type="button" variant="ghost" className="min-h-11" icon={<Trash2 size={16} />} onClick={() => { clearDiagnosticEvents(); setEvents([]); }}>Clear</Button>}
        />
        {events.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-content-secondary">No diagnostic events yet. Open Training Block, then return here and refresh.</div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-surface-secondary p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {event.level === 'error' ? <AlertTriangle size={16} className="text-accent-danger" /> : <CheckCircle2 size={16} className="text-content-muted" />}
                    <span className="font-mono text-xs font-semibold text-content-primary">{event.code}</span>
                    <Badge variant={eventTone(event.level)} size="sm">{event.scope}</Badge>
                  </div>
                  <span className="text-xs text-content-muted">{event.durationMs === undefined ? '' : `${event.durationMs} ms · `}{new Date(event.at).toLocaleTimeString()}</span>
                </div>
                <p className="mt-2 text-sm text-content-secondary">{event.summary}</p>
                {event.detail && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-content-muted">{JSON.stringify(event.detail)}</pre>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Button type="button" variant="secondary" className="min-h-11" icon={<Copy size={16} />} onClick={() => {
            void navigator.clipboard.writeText(report).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}>{copied ? 'Copied' : 'Copy diagnostic report'}</Button>
        </div>
      </Card>
    </main>
  );
}
