import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Modal } from './ui';
import { loadLinkSnapshot, previewTemplateLinks, saveTemplateLinks, type LinkPreview, type LinkResult } from '../services/templateLinkingService';
import { fetchTemplateById } from '../services/templateService';
import type { WorkoutTemplate } from '../types/workoutStructure.types';

interface Props {
  userId: string;
  workoutId: string;
  templateId: string;
  templateName?: string;
  onClose: () => void;
  onLinked: (template: WorkoutTemplate) => void;
}
export function TemplateLinkConfirmation({ userId, workoutId, templateId, templateName, onClose, onLinked }: Props) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [scanning, setScanning] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanError, setScanError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LinkResult | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    previewTemplateLinks(userId, workoutId, controller.signal).then(value => {
      if (!controller.signal.aborted) { setPreview(value); setScanning(false); }
    }).catch(() => {
      if (!controller.signal.aborted) { setScanError('Could not check your history. Retry the scan or link only this workout.'); setScanning(false); }
    });
    return () => controller.abort();
  }, [userId, workoutId, attempt]);
  async function save(all: boolean, retry = false) {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try {
      // Resolve the selected template before writing, so a refresh failure cannot hide a successful link.
      const template = await fetchTemplateById(templateId);
      if (!template) throw new Error('This template is unavailable. Choose another template.');
      const current = preview?.current ?? await loadLinkSnapshot(userId, workoutId);
      if (!mounted.current) return;
      const rows = retry && result ? result.failed : [current, ...(all ? preview?.matches ?? [] : [])];
      const saved = await saveTemplateLinks(userId, templateId, rows);
      if (!mounted.current) return;
      const combined = retry && result ? { linked: [...result.linked, ...saved.linked], skipped: [...result.skipped, ...saved.skipped], failed: saved.failed } : saved;
      setResult(combined);
      if (combined.linked.includes(workoutId)) {
        onLinked(template);
        if (!combined.failed.length && !combined.skipped.length) {
          toast.success(`${combined.linked.length} workout${combined.linked.length === 1 ? '' : 's'} linked to ${template.name}.`);
          onClose();
        }
      } else if (!saved.failed.length) setError('This workout changed since the preview. Close this dialog and reload before linking again.');
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not save the link. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return <Modal open onClose={() => { if (!busy.current) onClose(); }} title="Link workout to template" description={templateName} closeOnBackdrop={!saving} closeOnEscape={!saving} size="md" footer={
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" disabled={saving} onClick={onClose}>{result ? 'Done' : 'Cancel'}</Button>
      {result ? result.failed.length > 0 && <Button loading={saving} onClick={() => void save(false, true)}>Retry failed links</Button> : <>
        <Button variant="secondary" loading={saving} onClick={() => void save(false)}>Link this workout</Button>
        {!!preview?.matches.length && <Button loading={saving} onClick={() => void save(true)}>Link all {preview.matches.length + 1} workouts</Button>}
      </>}
    </div>
  }>
    <div className="space-y-3 text-content-secondary" aria-live="polite">
      {result ? <>
        <p>{result.linked.length} workout{result.linked.length === 1 ? '' : 's'} linked.</p>
        {!!result.skipped.length && <p>{result.skipped.length} left unchanged because a confirmed workout changed. Close and reload to review them.</p>}
        {!!result.failed.length && <p role="alert">{result.failed.length} could not be saved. Retry the failed links.</p>}
      </> : <>
        {scanning && <p>Checking your history for identical workout structures…</p>}
        {scanError && <div><p role="alert">{scanError}</p><Button variant="ghost" disabled={saving} onClick={() => { setScanning(true); setScanError(''); setAttempt(value => value + 1); }}>Retry history scan</Button></div>}
        {preview && <p>{preview.matches.length ? `${preview.matches.length} other unlinked workouts match this workout’s full structure.` : preview.comparable ? 'No other unlinked workouts match this workout’s full structure.' : 'This workout does not have enough structure data for a reliable history match. You can still link this workout.'}</p>}
        <p>Only your unlinked workouts are included. Work intervals, rests, machine type and manual RWN edits must match.</p>
      </>}
      {saving && <p>Saving links…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </Modal>;
}
