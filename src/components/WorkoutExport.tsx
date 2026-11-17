import { useEffect, useId, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button, Select } from './ui';
import { downloadWorkoutExport, loadWorkoutForExport, type WorkoutExportFormat } from '../services/workoutExportService';

interface WorkoutExportProps { workoutId: string }

export function WorkoutExport({ workoutId }: WorkoutExportProps) {
  const { user, isGuest } = useAuth();
  if (!user || isGuest) return null;
  // Remounting isolates state and pending downloads across both account and workout changes.
  return <ScopedWorkoutExport key={JSON.stringify([user.id, workoutId])} workoutId={workoutId} userId={user.id} />;
}

function ScopedWorkoutExport({ workoutId, userId }: WorkoutExportProps & { userId: string }) {
  const selectId = useId();
  const [format, setFormat] = useState<WorkoutExportFormat>('json');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function exportWorkout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const document = await loadWorkoutForExport(workoutId, userId);
      if (!mounted.current) return;
      if (format === 'csv' && (document.sample_availability.status !== 'available' || !document.samples.length)) {
        setMessage('No numeric samples are available for CSV. Choose JSON to export the saved workout summary and structure.');
        return;
      }
      // Serialization and download are synchronous, with no stale async file work after this check.
      downloadWorkoutExport(document, format);
      setMessage(`${format.toUpperCase()} download started.`);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Export failed. Retry export.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <div className="space-y-2 w-full md:w-auto">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <Select id={selectId} label="Export format" className="min-h-11" value={format} disabled={busy}
          onChange={event => { setFormat(event.target.value as WorkoutExportFormat); setMessage(null); setError(null); }}>
          <option value="json">JSON — full workout</option>
          <option value="csv">CSV — numeric samples</option>
        </Select>
        <Button type="button" variant="secondary" className="min-h-11" loading={busy} onClick={() => void exportWorkout()} icon={<Download size={16} aria-hidden="true" />}>
          {busy ? 'Preparing export…' : error ? 'Retry export' : 'Export workout'}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-content-primary">{error}</p>}
      <p role="status" className="text-sm text-content-secondary">{busy ? 'Loading saved workout…' : message}</p>
    </div>
  );
}
