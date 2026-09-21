import type { CaptureStore } from '@readyall/erglink';
import type { PM5CompletedCapture } from '@readyall/erglink/pm5';
import type { ActiveWorkoutSpec } from '../types/ergSession.types';
import { ingestPM5Capture, type PM5CaptureIngestionResult } from './pm5CaptureIngestion';
import { pm5CaptureStore } from './pm5CaptureStore';

export type PM5CapturePersistencePhase = 'saved' | 'ingesting' | 'ingested' | 'failed' | 'held';

export interface PM5CapturePersistenceState {
  phase: PM5CapturePersistencePhase;
  capture: PM5CompletedCapture;
  workoutId?: string;
  replayed?: boolean;
  error?: string;
}

interface LocalCaptureMetadata {
  ownerId: string;
  programmingContext?: ActiveWorkoutSpec;
}

type LocallyOwnedCapture = PM5CompletedCapture & {
  lcPersistence?: LocalCaptureMetadata;
};

export interface PM5CapturePersistenceDependencies {
  store: CaptureStore;
  ingest: (
    capture: PM5CompletedCapture,
    context: ActiveWorkoutSpec | undefined,
    ownerId: string,
  ) => Promise<PM5CaptureIngestionResult>;
  now?: () => string;
  settleDelayMs?: number;
}

function localMetadata(capture: PM5CompletedCapture): LocalCaptureMetadata | undefined {
  return (capture as LocallyOwnedCapture).lcPersistence;
}

function cleanCapture(capture: PM5CompletedCapture): PM5CompletedCapture {
  const result = structuredClone(capture) as LocallyOwnedCapture;
  delete result.lcPersistence;
  return result;
}

function ownedCapture(
  capture: PM5CompletedCapture,
  ownerId: string,
  programmingContext?: ActiveWorkoutSpec,
): LocallyOwnedCapture {
  const existing = localMetadata(capture);
  if (existing) return structuredClone(capture) as LocallyOwnedCapture;
  return Object.assign(structuredClone(capture), {
    lcPersistence: {
      ownerId,
      programmingContext: programmingContext ? structuredClone(programmingContext) : undefined,
    },
  });
}

export class PM5CapturePersistence {
  private readonly store: CaptureStore;
  private readonly ingest: PM5CapturePersistenceDependencies['ingest'];
  private readonly now: () => string;
  private readonly settleDelayMs: number;
  private readonly listeners = new Set<(state: PM5CapturePersistenceState) => void>();
  private readonly latestCaptures = new Map<string, LocallyOwnedCapture>();
  private readonly boundMetadata = new Map<string, LocalCaptureMetadata>();
  private programmingContext: ActiveWorkoutSpec | undefined;
  private ownerId: string | undefined;
  private staleRetryTimer: ReturnType<typeof setTimeout> | undefined;
  private state: PM5CapturePersistenceState | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor({
    store,
    ingest,
    now = () => new Date().toISOString(),
    settleDelayMs = 500,
  }: PM5CapturePersistenceDependencies) {
    this.store = store;
    this.ingest = ingest;
    this.now = now;
    this.settleDelayMs = settleDelayMs;
  }

  setOwnerId(ownerId: string | null): void {
    this.ownerId = ownerId ?? undefined;
    if (!ownerId) {
      this.programmingContext = undefined;
      this.boundMetadata.clear();
      if (this.staleRetryTimer) clearTimeout(this.staleRetryTimer);
      this.staleRetryTimer = undefined;
    }
  }

  clearOwnerId(ownerId: string): void {
    if (this.ownerId === ownerId) this.setOwnerId(null);
  }

  setProgrammingContext(context: ActiveWorkoutSpec): void {
    this.programmingContext = structuredClone(context);
  }

  getState(): PM5CapturePersistenceState | null {
    return this.state ? structuredClone(this.state) : null;
  }

  subscribe(listener: (state: PM5CapturePersistenceState) => void): () => void {
    this.listeners.add(listener);
    if (this.state) listener(this.getState()!);
    return () => this.listeners.delete(listener);
  }

  async persist(capture: PM5CompletedCapture, savedAt: string): Promise<void> {
    let metadata = localMetadata(capture) ?? this.boundMetadata.get(capture.captureId);
    const ownerId = metadata?.ownerId ?? this.ownerId;
    if (!ownerId) throw new Error('A signed-in athlete is required before recording a PM5 capture');
    if (!metadata) {
      metadata = {
        ownerId,
        programmingContext: this.programmingContext ? structuredClone(this.programmingContext) : undefined,
      };
      this.boundMetadata.set(capture.captureId, metadata);
      this.programmingContext = undefined;
    }
    const bound = ownedCapture(capture, metadata.ownerId, metadata.programmingContext);
    this.latestCaptures.set(capture.captureId, bound);
    const operation = this.queue
      .catch(() => undefined)
      .then(() => this.persistLatest(capture.captureId, savedAt));
    this.queue = operation;
    return operation;
  }

  private async persistLatest(captureId: string, savedAt: string): Promise<void> {
    const initial = this.latestCaptures.get(captureId);
    if (!initial) return;

    const existing = await this.store.get(captureId);
    if (existing?.uploadStatus === 'acknowledged') {
      const metadata = localMetadata(initial);
      if (!metadata) throw new Error('PM5 capture owner metadata is missing');
      const enriched = await this.store.enrichAcknowledged(initial, savedAt);
      const capture = cleanCapture(enriched.capture);
      const result = await this.ingest(capture, metadata.programmingContext, metadata.ownerId);
      this.latestCaptures.delete(captureId);
      this.publish({
        phase: 'ingested',
        capture,
        workoutId: result.workoutId,
        replayed: true,
      });
      return;
    }

    await this.store.save(initial, savedAt);
    if (this.settleDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.settleDelayMs));
    }
    const latest = this.latestCaptures.get(captureId) ?? initial;
    this.latestCaptures.delete(captureId);
    const stored = await this.store.save(latest, this.now());
    const capture = cleanCapture(latest);
    const metadata = localMetadata(latest);
    if (!metadata) throw new Error('PM5 capture owner metadata is missing');

    if (stored.uploadStatus === 'held') {
      this.publish({ phase: 'held', capture });
      return;
    }

    this.publish({ phase: 'saved', capture });
    await this.store.beginUpload(captureId, this.now());
    this.publish({ phase: 'ingesting', capture });

    try {
      const result = await this.ingest(capture, metadata.programmingContext, metadata.ownerId);
      await this.store.acknowledge(captureId, {
        acknowledgedAt: this.now(),
        upstreamWorkoutId: result.workoutId,
      });
      this.publish({
        phase: 'ingested',
        capture,
        workoutId: result.workoutId,
        replayed: result.replayed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.failUpload(captureId, message, this.now());
      this.publish({ phase: 'failed', capture, error: message });
      throw error;
    }
  }

  async retryPending(limit = 20): Promise<void> {
    if (!this.ownerId) return;
    const recoveredAt = this.now();
    const staleAfterMs = 5 * 60 * 1000;
    const staleBefore = new Date(new Date(recoveredAt).getTime() - staleAfterMs).toISOString();
    await this.store.recoverStaleUploads(staleBefore, recoveredAt);

    const ownedRecords: Awaited<ReturnType<CaptureStore['listPending']>> = [];
    const pageSize = 50;
    let offset = 0;
    while (ownedRecords.length < limit) {
      const page = await this.store.listPending(pageSize, offset);
      for (const record of page) {
        const metadata = localMetadata(record.capture);
        if (metadata?.ownerId === this.ownerId) ownedRecords.push(record);
        if (ownedRecords.length >= limit) break;
      }
      offset += page.length;
      if (page.length < pageSize) break;
    }

    for (const record of ownedRecords) {
      try {
        await this.persist(record.capture, this.now());
      } catch {
        // State and durable failure details are already retained by persist().
      }
    }

    if (!this.staleRetryTimer && this.ownerId) {
      this.staleRetryTimer = setTimeout(() => {
        this.staleRetryTimer = undefined;
        void this.retryPending(limit);
      }, staleAfterMs);
      const nodeTimer = this.staleRetryTimer as unknown as { unref?: () => void };
      nodeTimer.unref?.();
    }
  }

  private publish(state: PM5CapturePersistenceState): void {
    this.state = structuredClone(state);
    for (const listener of this.listeners) listener(this.getState()!);
  }
}

export const pm5CapturePersistence = new PM5CapturePersistence({
  store: pm5CaptureStore,
  ingest: (capture, context, ownerId) => ingestPM5Capture(capture, context, ownerId),
});
