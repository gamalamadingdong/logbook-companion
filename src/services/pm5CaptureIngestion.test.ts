import { describe, expect, it } from 'vitest';
import type { PM5WorkoutInsert, PM5CaptureIngestionClient } from './pm5CaptureIngestion';
import {
  buildPM5WorkoutInsert,
  ingestPM5Capture,
  pm5CaptureExternalId,
} from './pm5CaptureIngestion';
import { createValidPM5Capture } from './pm5CaptureTestFixture';

class FakeIngestionClient implements PM5CaptureIngestionClient {
  readonly rows = new Map<string, { id: string; payload: PM5WorkoutInsert }>();
  insertCount = 0;
  updateCount = 0;

  private readonly userId: string;

  constructor(userId = '11111111-2222-4333-8444-555555555555') {
    this.userId = userId;
  }

  async getCurrentUserId(): Promise<string> {
    return this.userId;
  }

  async insertWorkout(payload: PM5WorkoutInsert): Promise<{ id: string } | null> {
    this.insertCount += 1;
    if (this.rows.has(payload.external_id)) return null;
    const row = { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', payload };
    this.rows.set(payload.external_id, row);
    return { id: row.id };
  }

  async findWorkout(externalId: string, userId: string): Promise<{ id: string } | null> {
    const row = this.rows.get(externalId);
    return row && row.payload.user_id === userId ? { id: row.id } : null;
  }

  async updateWorkout(workoutId: string, payload: PM5WorkoutInsert, userId: string): Promise<void> {
    const row = this.rows.get(payload.external_id);
    if (!row || row.id !== workoutId || row.payload.user_id !== userId) throw new Error('Owned workout required');
    this.rows.set(payload.external_id, { id: workoutId, payload });
    this.updateCount += 1;
  }
}

describe('PM5 capture ingestion', () => {
  it('maps validated evidence into searchable columns and retained raw data', () => {
    const capture = createValidPM5Capture();
    const userId = '11111111-2222-4333-8444-555555555555';
    const payload = buildPM5WorkoutInsert(capture, userId, {
      _v: 1,
      type: 'fixed_distance',
      value: 500,
      source_rwn: '500m',
      canonical_name: '500m',
      template_id: '99999999-8888-4777-8666-555555555555',
      group_assignment_id: '12345678-1234-4234-8234-123456789012',
    });

    expect(payload).toMatchObject({
      user_id: userId,
      external_id: `pm5:${userId}:v2:${capture.captureId}`,
      source: 'erg_link_live',
      workout_type: 'rower',
      workout_name: 'FixedDistanceSplits',
      canonical_name: '500m',
      distance_meters: 500,
      duration_seconds: 120,
      avg_split_500m: 120,
      average_stroke_rate: 30,
      template_id: '99999999-8888-4777-8666-555555555555',
    });
    expect(payload.raw_data).toMatchObject({
      distance: 500,
      time: 1200,
      stroke_data: true,
      pm5_capture: {
        source: 'pm5_capture_v2',
        capture_id: capture.captureId,
        capture_version: 2,
        group_assignment_id: '12345678-1234-4234-8234-123456789012',
        evidence_validation: { valid: true, violations: [] },
      },
    });
  });

  it('returns the same owned workout UUID when a capture is replayed', async () => {
    const capture = createValidPM5Capture();
    const client = new FakeIngestionClient();

    const first = await ingestPM5Capture(capture, undefined, undefined, client);
    const replay = await ingestPM5Capture(capture, undefined, undefined, client);

    expect(first).toEqual({ workoutId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', replayed: false });
    expect(replay).toEqual({ workoutId: first.workoutId, replayed: true });
    expect(client.rows.size).toBe(1);
    expect(client.insertCount).toBe(2);
    expect(client.updateCount).toBe(1);
  });

  it('namespaces capture identity by owner and version', () => {
    const capture = createValidPM5Capture('same-capture');
    expect(pm5CaptureExternalId('owner-a', capture)).not.toBe(pm5CaptureExternalId('owner-b', capture));
    expect(pm5CaptureExternalId('owner-a', capture)).toContain(':v2:');
  });

  it('refuses to ingest a capture bound to another owner', async () => {
    const capture = createValidPM5Capture();
    const client = new FakeIngestionClient('owner-b');
    await expect(ingestPM5Capture(capture, undefined, 'owner-a', client))
      .rejects.toThrow(/different signed-in athlete/);
    expect(client.insertCount).toBe(0);
  });

  it('refuses malformed capture evidence before database insertion', () => {
    const capture = createValidPM5Capture();
    capture.summary!.workDistanceMeters = 499;
    expect(() => buildPM5WorkoutInsert(capture, 'owner-a')).toThrow(/work_distance_mismatch/);
  });
});
