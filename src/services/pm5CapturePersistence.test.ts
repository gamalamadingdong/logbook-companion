import { describe, expect, it, vi } from 'vitest';
import { MemoryCaptureStore } from '@readyall/erglink';
import type { PM5CompletedCapture } from '@readyall/erglink/pm5';
import type { ActiveWorkoutSpec } from '../types/ergSession.types';
import { PM5CapturePersistence } from './pm5CapturePersistence';
import { createValidPM5Capture } from './pm5CaptureTestFixture';

const ownerA = '11111111-2222-4333-8444-555555555555';
const ownerB = '99999999-8888-4777-8666-555555555555';

function persistenceFor(
  store: MemoryCaptureStore,
  ingest: ConstructorParameters<typeof PM5CapturePersistence>[0]['ingest'],
  settleDelayMs = 0,
): PM5CapturePersistence {
  const persistence = new PM5CapturePersistence({
    store,
    ingest,
    now: () => '2026-09-21T15:00:00.000Z',
    settleDelayMs,
  });
  persistence.setOwnerId(ownerA);
  return persistence;
}

describe('PM5 capture persistence', () => {
  it('saves locally, ingests once, and acknowledges with the owned workout UUID', async () => {
    const store = new MemoryCaptureStore();
    const ingest = vi.fn(async () => ({ workoutId: 'workout-1', replayed: false }));
    const persistence = persistenceFor(store, ingest);
    const capture = createValidPM5Capture();
    const states: string[] = [];
    persistence.subscribe((state) => states.push(state.phase));
    persistence.setProgrammingContext({ _v: 1, type: 'fixed_distance', value: 500, source_rwn: '500m' });

    await persistence.persist(capture, '2026-09-21T14:32:01.000Z');

    expect(states).toEqual(['saved', 'ingesting', 'ingested']);
    expect(ingest).toHaveBeenCalledWith(
      capture,
      expect.objectContaining({ source_rwn: '500m' }),
      ownerA,
    );
    expect(await store.get(capture.captureId)).toMatchObject({
      uploadStatus: 'acknowledged',
      upstreamWorkoutId: 'workout-1',
      attemptCount: 1,
    });
  });

  it('retains a failed upload and retries it to acknowledgement for the same owner', async () => {
    const store = new MemoryCaptureStore();
    let attempt = 0;
    const ingest = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('network unavailable');
      return { workoutId: 'workout-retried', replayed: true };
    });
    const persistence = persistenceFor(store, ingest);
    const capture = createValidPM5Capture('capture-retry');

    await expect(persistence.persist(capture, '2026-09-21T14:32:01.000Z'))
      .rejects.toThrow('network unavailable');
    expect(await store.get(capture.captureId)).toMatchObject({
      uploadStatus: 'failed',
      attemptCount: 1,
      lastError: 'network unavailable',
    });

    await persistence.retryPending();
    expect(await store.get(capture.captureId)).toMatchObject({
      uploadStatus: 'acknowledged',
      upstreamWorkoutId: 'workout-retried',
      attemptCount: 2,
    });
    expect(persistence.getState()).toMatchObject({ phase: 'ingested', replayed: true });
  });

  it('recovers an upload interrupted by an app crash', async () => {
    const store = new MemoryCaptureStore();
    const ingest = vi.fn(async () => ({ workoutId: 'workout-recovered', replayed: true }));
    const persistence = persistenceFor(store, ingest);
    const capture = Object.assign(createValidPM5Capture('capture-crash'), {
      lcPersistence: { ownerId: ownerA },
    });
    await store.save(capture, '2026-09-21T14:00:00.000Z');
    await store.beginUpload(capture.captureId, '2026-09-21T14:01:00.000Z');

    persistence.setOwnerId(ownerA);
    await persistence.retryPending();

    expect(ingest).toHaveBeenCalledOnce();
    expect(await store.get(capture.captureId)).toMatchObject({
      uploadStatus: 'acknowledged',
      upstreamWorkoutId: 'workout-recovered',
      attemptCount: 2,
    });
  });

  it('does not replay another athlete owner capture', async () => {
    const store = new MemoryCaptureStore();
    const failing = persistenceFor(store, async () => {
      throw new Error('offline');
    });
    const capture = createValidPM5Capture('capture-owner-a');
    await expect(failing.persist(capture, '2026-09-21T14:32:01.000Z')).rejects.toThrow('offline');

    const ingest = vi.fn(async () => ({ workoutId: 'wrong-owner', replayed: false }));
    const ownerBPersistence = persistenceFor(store, ingest);
    ownerBPersistence.setOwnerId(ownerB);
    await ownerBPersistence.retryPending();

    expect(ingest).not.toHaveBeenCalled();
    expect(await store.get(capture.captureId)).toMatchObject({ uploadStatus: 'failed' });
  });

  it('pages past another athlete’s pending captures', async () => {
    const store = new MemoryCaptureStore();
    for (let index = 0; index < 55; index += 1) {
      const capture = Object.assign(createValidPM5Capture(`owner-b-${index}`), {
        lcPersistence: { ownerId: ownerB },
      });
      await store.save(capture, `2026-09-21T13:${String(index).padStart(2, '0')}:00.000Z`);
    }
    const owned = Object.assign(createValidPM5Capture('owner-a-later'), {
      lcPersistence: { ownerId: ownerA },
    });
    await store.save(owned, '2026-09-21T14:30:00.000Z');
    const ingest = vi.fn(async () => ({ workoutId: 'owned-workout', replayed: false }));
    const persistence = persistenceFor(store, ingest);

    await persistence.retryPending(1);

    expect(ingest).toHaveBeenCalledOnce();
    expect(await store.get(owned.captureId)).toMatchObject({ uploadStatus: 'acknowledged' });
  });

  it('binds programming context to each capture before queued persistence', async () => {
    const store = new MemoryCaptureStore();
    const seen: string[] = [];
    const persistence = persistenceFor(store, async (_capture, context) => {
      seen.push(context?.source_rwn ?? 'missing');
      return { workoutId: `workout-${seen.length}`, replayed: false };
    });
    const first = createValidPM5Capture('capture-a');
    const second = createValidPM5Capture('capture-b');
    const third = createValidPM5Capture('capture-c');

    persistence.setProgrammingContext({ _v: 1, type: 'fixed_distance', value: 500, source_rwn: '500m' });
    const firstSave = persistence.persist(first, '2026-09-21T14:32:01.000Z');
    persistence.setProgrammingContext({ _v: 1, type: 'fixed_distance', value: 2000, source_rwn: '2000m' });
    const secondSave = persistence.persist(second, '2026-09-21T14:33:01.000Z');
    const thirdSave = persistence.persist(third, '2026-09-21T14:34:01.000Z');
    await Promise.all([firstSave, secondSave, thirdSave]);

    expect(seen).toEqual(['500m', '2000m', 'missing']);
  });

  it('coalesces richer terminal snapshots before acknowledgement', async () => {
    const store = new MemoryCaptureStore();
    const ingest = vi.fn(async (
      _capture: PM5CompletedCapture,
      _context: ActiveWorkoutSpec | undefined,
      _ownerId: string,
    ) => ({ workoutId: 'workout-rich', replayed: false }));
    const persistence = persistenceFor(store, ingest, 10);
    const first = createValidPM5Capture('capture-rich');
    const richer = structuredClone(first);
    richer.rawNotifications.push({
      sequence: 99,
      characteristic: 'ce060036-43e5-11e4-916c-0800200c9a66',
      receivedAt: '2026-09-21T14:32:00.500Z',
      bytes: [1, 2, 3],
    });

    await Promise.all([
      persistence.persist(first, '2026-09-21T14:32:01.000Z'),
      persistence.persist(richer, '2026-09-21T14:32:01.010Z'),
    ]);

    expect(ingest).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({ rawNotifications: richer.rawNotifications }),
      undefined,
      ownerA,
    );

    const later = structuredClone(richer);
    later.rawNotifications.push({
      sequence: 100,
      characteristic: 'ce060038-43e5-11e4-916c-0800200c9a66',
      receivedAt: '2026-09-21T14:32:02.000Z',
      bytes: [4, 5, 6],
    });
    await persistence.persist(later, '2026-09-21T14:32:02.100Z');

    expect(ingest).toHaveBeenCalledTimes(2);
    expect(await store.get(later.captureId)).toMatchObject({
      uploadStatus: 'acknowledged',
      upstreamWorkoutId: 'workout-rich',
      capture: { rawNotifications: later.rawNotifications },
    });
  });

  it('holds incomplete captures without attempting ingestion', async () => {
    const store = new MemoryCaptureStore();
    const ingest = vi.fn(async () => ({ workoutId: 'unexpected', replayed: false }));
    const persistence = persistenceFor(store, ingest);
    const capture = createValidPM5Capture('capture-held');
    capture.status = 'incomplete_capture';

    await persistence.persist(capture, '2026-09-21T14:32:01.000Z');

    expect(ingest).not.toHaveBeenCalled();
    expect(await store.get(capture.captureId)).toMatchObject({ uploadStatus: 'held' });
    expect(persistence.getState()).toMatchObject({ phase: 'held' });
  });
});
