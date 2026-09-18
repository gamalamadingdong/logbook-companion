import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCompletedWorkoutInsert, createCompletedWorkout, readCompletedWorkoutFromRow, updateCompletedWorkout } from './completedWorkoutEntryService';
import type { CompletedWorkoutEntryV1 } from '../types/completedWorkoutEntry';

const result: CompletedWorkoutEntryV1 = {
  _v: 1,
  activity: 'indoor_row',
  equipment: { brand: 'other', name: 'Gym rower' },
  status: 'completed',
  completedAt: '2026-09-18T12:30:00.000Z',
  timezone: 'America/New_York',
  summary: { distanceMeters: 1200, durationSeconds: 330, watts: 145 },
  detailCoverage: 'full',
  segments: [
    { role: 'work', target: { kind: 'distance', value: 400 }, distanceMeters: 400, durationSeconds: 95 },
    { role: 'rest', target: null, durationSeconds: 30 },
    { role: 'work', target: { kind: 'time', value: 120 }, distanceMeters: 800, durationSeconds: 120 },
    { role: 'rest', target: null, durationSeconds: 85 },
  ],
  workTimeSeconds: 215,
  notes: 'Variable session',
  plannedRwn: null,
};

describe('general manual workout persistence', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a new completed workout through the staging client guard', async () => {
    const network = vi.fn(async () => new Response(JSON.stringify({ id: 'saved-workout' }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', network);
    await expect(createCompletedWorkout('user-1', result)).resolves.toBe('saved-workout');
    expect(network).toHaveBeenCalledTimes(1);
    const [url, init] = network.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/rest/v1/workout_logs');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ source: 'manual',
      raw_data: { source: 'general_manual_entry' } });
  });

  it('sends an owned edit through the staging client guard', async () => {
    const network = vi.fn(async () => new Response(JSON.stringify({ id: 'saved-workout' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', network);
    await expect(updateCompletedWorkout('saved-workout', 'user-1', result)).resolves.toBeUndefined();
    expect(network).toHaveBeenCalledTimes(1);
    const [url, init] = network.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('user_id=eq.user-1');
    expect(url).toContain('source=eq.manual');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toMatchObject({ source: 'manual',
      raw_data: { source: 'general_manual_entry' } });
  });

  it('projects a validated result into the owned log and preserves all ordered detail', () => {
    const insert = buildCompletedWorkoutInsert('user-1', result);
    expect(insert).toMatchObject({
      user_id: 'user-1',
      source: 'manual',
      workout_type: 'row',
      completed_at: '2026-09-18T12:30:00.000Z',
      distance_meters: 1200,
      duration_seconds: 330,
      duration_minutes: 6,
      watts: 145,
      notes: 'Variable session',
      raw_data: {
        source: 'general_manual_entry',
        completed_result: result,
      },
    });
    expect(insert.avg_split_500m).toBeCloseTo(215 / 1200 * 500);
    expect(insert.external_id).toBeUndefined();
    expect(insert.c2_published_at).toBeUndefined();
  });

  it('uses measured work distance and work time for interval pace', () => {
    const withMovingRest: CompletedWorkoutEntryV1 = {
      ...result,
      summary: { distanceMeters: 1300, durationSeconds: 330 },
      segments: result.segments.map((segment, index) => index === 1 ? { ...segment, distanceMeters: 100 } : segment),
    };
    expect(buildCompletedWorkoutInsert('user-1', withMovingRest).avg_split_500m).toBeCloseTo(215 / 1200 * 500);
  });

  it('indexes a selected LC template for later comparison', () => {
    const selected: CompletedWorkoutEntryV1 = { ...result, plannedRwn: '4x500m/1:00r',
      plannedTemplate: { id: '11111111-2222-4333-8444-555555555555', name: 'Four 500s' } };
    const insert = buildCompletedWorkoutInsert('user-1', selected);
    expect(insert.template_id).toBe(selected.plannedTemplate?.id);
    expect(insert.raw_data).toMatchObject({ completed_result: { plannedRwn: selected.plannedRwn,
      plannedTemplate: selected.plannedTemplate } });
  });

  it('indexes Concept2 RowErg work and moving rest distance separately', () => {
    const measured: CompletedWorkoutEntryV1 = {
      ...result, equipment: { brand: 'concept2', name: 'RowErg' },
      summary: { distanceMeters: 1300, durationSeconds: 330 },
      segments: result.segments.map((segment, index) => index === 1
        ? { ...segment, distanceMeters: 100 }
        : segment.role === 'work' ? { ...segment, intervalKind: index === 0 ? 'distance' as const : 'time' as const } : segment),
    };
    const insert = buildCompletedWorkoutInsert('user-1', measured);
    expect(insert.distance_meters).toBe(1200);
    expect(insert.rest_distance_meters).toBe(100);
    expect(insert.duration_seconds).toBe(330);
    expect(insert.raw_data).toMatchObject({ completed_result: { summary: { distanceMeters: 1300 } } });
  });

  it('ignores malformed stored detail instead of breaking the workout list', () => {
    expect(readCompletedWorkoutFromRow({ source: 'manual', raw_data: { source: 'general_manual_entry', completed_result: { _v: 1 } } })).toBeNull();
  });

  it('indexes a named other activity without changing the durable result', () => {
    const insert = buildCompletedWorkoutInsert('user-1', {
      ...result, activity: 'other', activityName: 'Hike', equipment: null,
    });
    expect(insert.workout_name).toBe('Hike · 1,200 m');
    expect(insert.workout_type).toBe('other');
  });

  it('reads only a versioned general manual result, not another manual or imported row', () => {
    const row = { id: 'workout-1', user_id: 'user-1', source: 'manual', raw_data: { source: 'general_manual_entry', completed_result: result } };
    expect(readCompletedWorkoutFromRow(row)?.segments).toHaveLength(4);
    expect(readCompletedWorkoutFromRow({ ...row, raw_data: { source: 'training_block_manual_entry' } })).toBeNull();
    expect(readCompletedWorkoutFromRow({ ...row, source: 'concept2' })).toBeNull();
  });
});
