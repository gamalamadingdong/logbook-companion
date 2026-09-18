import { describe, expect, it } from 'vitest';
import { completedWorkoutFromRow, mapCompletedWorkoutToConcept2, type CompletedWorkoutV1 } from '../../supabase/functions/_shared/concept2/publication';
import { bindDevelopmentFixture, completedWorkoutFixtures } from '../../supabase/functions/_shared/concept2/fixtures/index';

const fixedDistance: CompletedWorkoutV1 = {
  _v: 1,
  workoutId: 'f7e75f35-2dda-4a5a-87b8-bbbecf1e8013',
  source: 'manual',
  machine: 'rower',
  shape: { kind: 'fixed_distance' },
  completedAt: '2026-09-13T13:04:00.000Z',
  distanceMeters: 8455,
  workTimeSeconds: 2400,
  restDistanceMeters: 0,
  restTimeSeconds: 0,
};

describe('Concept2 completed-workout publication mapper', () => {
  const generalManual = {
    id: '44444444-5555-4666-8777-888888888888',
    user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    source: 'manual', workout_type: 'row', completed_at: '2026-09-18T12:30:00.000Z',
    distance_meters: 10000, duration_seconds: 2400, rest_distance_meters: null,
    manual_rwn: null, external_id: null, template_id: null,
    raw_data: { source: 'general_manual_entry', completed_result: {
      _v: 1, activity: 'indoor_row', equipment: { brand: 'concept2', name: 'RowErg' },
      status: 'completed', completedAt: '2026-09-18T12:30:00.000Z',
      timezone: 'America/New_York', summary: { distanceMeters: 10000, durationSeconds: 2400 },
      detailCoverage: 'none', segments: [], notes: '', plannedRwn: null,
    } },
  };

  it('maps an owned saved single-piece RowErg result without inventing a programmed shape', () => {
    const completed = completedWorkoutFromRow(generalManual);
    expect(completed).toMatchObject({ workoutId: generalManual.id, source: 'manual',
      machine: 'rower', shape: { kind: 'fixed_distance' }, completedAt: generalManual.completed_at,
      distanceMeters: 10000, workTimeSeconds: 2400, timezone: 'America/New_York' });
    expect(mapCompletedWorkoutToConcept2(completed, {
      timezone: 'America/New_York', weightClass: 'H', privacy: 'private',
    })).toMatchObject({ type: 'rower', workout_type: 'unknown', distance: 10000,
      time: 24000, date: '2026-09-18 08:30:00',
      comments: `Logbook Companion workout ID: ${generalManual.id}` });
    expect(() => mapCompletedWorkoutToConcept2(completed, {
      timezone: 'America/Los_Angeles', weightClass: 'H', privacy: 'private',
    })).toThrow(/timezone/);
  });

  it('accepts a saved template link only when it matches the completed result', () => {
    const id = '11111111-2222-4333-8444-555555555555';
    const linked = { ...generalManual, template_id: id,
      raw_data: { ...generalManual.raw_data, completed_result: {
        ...generalManual.raw_data.completed_result, plannedRwn: '10000m',
        plannedTemplate: { id, name: '10K' } } } };
    expect(completedWorkoutFromRow(linked)).toMatchObject({ workoutId: generalManual.id,
      shape: { kind: 'fixed_distance' } });
    expect(() => completedWorkoutFromRow({ ...linked, template_id: '22222222-2222-4333-8444-555555555555' })).toThrow();
  });

  it('rejects ineligible or tampered general manual results', () => {
    const changed = (patch: Record<string, unknown>) => ({ ...generalManual,
      raw_data: { ...generalManual.raw_data,
        completed_result: { ...generalManual.raw_data.completed_result, ...patch } } });
    expect(() => completedWorkoutFromRow(changed({ status: 'stopped_early' }))).toThrow();
    expect(() => completedWorkoutFromRow(changed({ equipment: { brand: 'other', name: 'Gym rower' } }))).toThrow();
    expect(() => completedWorkoutFromRow(changed({ activity: 'ski_erg' }))).toThrow();
    expect(() => completedWorkoutFromRow(changed({ segments: [{ role: 'work', distanceMeters: 10000 }] }))).toThrow();
    expect(() => completedWorkoutFromRow(changed({ summary: { distanceMeters: 9999, durationSeconds: 2400 } }))).toThrow();
    expect(() => completedWorkoutFromRow(changed({ summary: { distanceMeters: 10000, durationSeconds: 2400.01 } }))).toThrow();
    expect(() => completedWorkoutFromRow(changed({ timezone: 'Invalid/Zone' }))).toThrow();
    expect(() => completedWorkoutFromRow({ ...generalManual, user_id: undefined })).toThrow();
  });

  it.each([
    ['fixed distance', [
      { role: 'work', intervalKind: 'distance', target: null, distanceMeters: 500, durationSeconds: 120 },
      { role: 'rest', target: null, durationSeconds: 60 },
      { role: 'work', intervalKind: 'distance', target: null, distanceMeters: 500, durationSeconds: 120 },
    ], 'FixedDistanceInterval', 1000, 300, 0, 240],
    ['fixed time', [
      { role: 'work', intervalKind: 'time', target: null, distanceMeters: 480, durationSeconds: 120 },
      { role: 'rest', target: null, durationSeconds: 45 },
      { role: 'work', intervalKind: 'time', target: null, distanceMeters: 500, durationSeconds: 120 },
      { role: 'rest', target: null, durationSeconds: 45 },
      { role: 'work', intervalKind: 'time', target: null, distanceMeters: 520, durationSeconds: 120 },
    ], 'FixedTimeInterval', 1500, 450, 0, 360],
    ['variable with rest distance', [
      { role: 'work', intervalKind: 'distance', target: null, distanceMeters: 500, durationSeconds: 120 },
      { role: 'rest', target: null, distanceMeters: 25, durationSeconds: 30 },
      { role: 'work', intervalKind: 'time', target: null, distanceMeters: 700, durationSeconds: 180 },
      { role: 'rest', target: null, distanceMeters: 15, durationSeconds: 15 },
    ], 'VariableInterval', 1240, 345, 40, 300],
  ] as const)('maps a saved %s manual interval result', (_label, segments, shape, totalDistance, elapsed, restDistance, workTime) => {
    const row = { ...generalManual, distance_meters: totalDistance - restDistance,
      rest_distance_meters: restDistance, duration_seconds: elapsed,
      raw_data: { source: 'general_manual_entry', completed_result: {
        ...generalManual.raw_data.completed_result, detailCoverage: 'full',
        summary: { distanceMeters: totalDistance, durationSeconds: elapsed },
        workTimeSeconds: workTime, segments,
      } } };
    const completed = completedWorkoutFromRow(row);
    expect(completed).toMatchObject({ _v: 2, source: 'manual', ownerId: row.user_id,
      distanceMeters: totalDistance - restDistance, workTimeSeconds: workTime,
      restDistanceMeters: restDistance, restTimeSeconds: elapsed - workTime });
    const payload = mapCompletedWorkoutToConcept2(completed, {
      timezone: 'America/New_York', weightClass: 'H', privacy: 'private',
    });
    expect(payload).toMatchObject({ workout_type: shape, distance: totalDistance - restDistance,
      time: workTime * 10, rest_distance: restDistance, rest_time: (elapsed - workTime) * 10 });
    expect(payload.workout?.intervals).toHaveLength(segments.filter(item => item.role === 'work').length);
  });

  it('fails closed for incomplete or mismatched manual interval results', () => {
    const segments = [
      { role: 'work', intervalKind: 'distance', target: null, distanceMeters: 500, durationSeconds: 120 },
      { role: 'rest', target: null, durationSeconds: 60 },
      { role: 'work', intervalKind: 'distance', target: null, distanceMeters: 500, durationSeconds: 120 },
    ];
    const row = { ...generalManual, duration_seconds: 300, raw_data: { source: 'general_manual_entry',
      completed_result: { ...generalManual.raw_data.completed_result,
        detailCoverage: 'full', summary: { distanceMeters: 1000, durationSeconds: 300 },
        workTimeSeconds: 240, segments } } };
    const changed = (patch: Record<string, unknown>) => ({ ...row,
      raw_data: { ...row.raw_data, completed_result: { ...row.raw_data.completed_result, ...patch } } });
    expect(() => completedWorkoutFromRow(changed({ detailCoverage: 'partial' }))).toThrow();
    expect(() => completedWorkoutFromRow(changed({ segments: segments.map(({ intervalKind: ignored, ...rest }) => {
      void ignored; return rest;
    }) }))).toThrow();
    expect(() => completedWorkoutFromRow(changed({ workTimeSeconds: 250 }))).toThrow();
    expect(() => completedWorkoutFromRow({ ...row, distance_meters: 999 })).toThrow();
    expect(() => completedWorkoutFromRow(changed({ status: 'stopped_early' }))).toThrow();
  });

  it('binds a named interval fixture to a durable owned LC identity', () => {
    const bound = bindDevelopmentFixture('fixed_distance_intervals_2x500m',
      '44444444-5555-4666-8777-888888888888', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '2026-09-17T19:00:00.000Z');
    expect(bound.workoutId).toBe('44444444-5555-4666-8777-888888888888');
    expect(bound.ownerId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(bound.completedAt).toBe('2026-09-17T19:00:00.000Z');
    expect(completedWorkoutFixtures.fixed_distance_intervals_2x500m.workoutId).not.toBe(bound.workoutId);
    expect(() => bindDevelopmentFixture('not_a_fixture', bound.workoutId, bound.ownerId, bound.completedAt)).toThrow();
  });

  it('loads only an intact owned synthetic fixture result from its LC row', () => {
    const id = '44444444-5555-4666-8777-888888888888';
    const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const completed = bindDevelopmentFixture('fixed_time_intervals_3x120s', id, owner, '2026-09-17T19:00:00.000Z');
    const row = { id, user_id: owner, source: 'manual', workout_type: 'row', completed_at: completed.completedAt,
      distance_meters: completed.distanceMeters, duration_seconds: completed.workTimeSeconds,
      rest_distance_meters: completed.restDistanceMeters, manual_rwn: null, external_id: null, template_id: null,
      raw_data: { source: 'concept2_development_fixture', fixture_name: 'fixed_time_intervals_3x120s', completed_workout: completed } };
    expect(completedWorkoutFromRow(row)).toEqual(completed);
    expect(() => completedWorkoutFromRow({ ...row, distance_meters: 999 })).toThrow();
    expect(() => completedWorkoutFromRow({ ...row, user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })).toThrow();
  });
  it('preserves the proven fixed-distance development payload', () => {
    expect(mapCompletedWorkoutToConcept2(fixedDistance, {
      timezone: 'America/New_York', weightClass: 'H', privacy: 'private',
    })).toEqual({
      type: 'rower',
      date: '2026-09-13 09:04:00',
      timezone: 'America/New_York',
      distance: 8455,
      time: 24000,
      workout_type: 'unknown',
      weight_class: 'H',
      privacy: 'private',
      comments: 'Logbook Companion workout ID: f7e75f35-2dda-4a5a-87b8-bbbecf1e8013',
    });
  });

  it('maps a completed fixed-time workout with measured distance', () => {
    expect(mapCompletedWorkoutToConcept2({
      ...fixedDistance,
      workoutId: '11111111-2222-4333-8444-555555555555',
      shape: { kind: 'fixed_time' },
      completedAt: '2026-09-17T12:30:00.000Z',
      distanceMeters: 7321,
      workTimeSeconds: 1800,
    }, {
      timezone: 'America/New_York', weightClass: 'L', privacy: 'partners',
    })).toEqual({
      type: 'rower',
      date: '2026-09-17 08:30:00',
      timezone: 'America/New_York',
      distance: 7321,
      time: 18000,
      workout_type: 'FixedTimeSplits',
      weight_class: 'L',
      privacy: 'partners',
      comments: 'Logbook Companion workout ID: 11111111-2222-4333-8444-555555555555',
    });
  });

  it('normalizes an owned fixed-time manual row without losing measured totals', () => {
    expect(completedWorkoutFromRow({
      id: '11111111-2222-4333-8444-555555555555',
      source: 'manual', workout_type: 'row', completed_at: '2026-09-17T12:30:00.000Z',
      distance_meters: 7321, duration_seconds: 1800, rest_distance_meters: 0,
      manual_rwn: '1800s', external_id: null, template_id: null,
      raw_data: { source: 'training_block_manual_entry', mode: 'row',
        entry_surface: 'concept2_development_test', publication_shape: 'fixed_time' },
    })).toEqual({
      _v: 1,
      workoutId: '11111111-2222-4333-8444-555555555555',
      source: 'manual', machine: 'rower', shape: { kind: 'fixed_time' },
      completedAt: '2026-09-17T12:30:00.000Z', distanceMeters: 7321, workTimeSeconds: 1800,
      restDistanceMeters: 0, restTimeSeconds: 0,
    });
  });

  it('formats provider dates across a UTC day boundary and rounds to deciseconds', () => {
    const payload = mapCompletedWorkoutToConcept2({
      ...fixedDistance,
      completedAt: '2026-09-18T00:15:00.000Z',
      workTimeSeconds: 90.04,
    }, { timezone: 'America/Los_Angeles', weightClass: 'H', privacy: 'private' });
    expect(payload.date).toBe('2026-09-17 17:15:00');
    expect(payload.time).toBe(900);
  });

  it('rejects an unsupported manual shape instead of flattening it', () => {
    expect(() => completedWorkoutFromRow({
      id: '11111111-2222-4333-8444-555555555555', source: 'manual', workout_type: 'row',
      completed_at: '2026-09-17T12:30:00.000Z', distance_meters: 7321, duration_seconds: 1800,
      rest_distance_meters: 0, manual_rwn: '7321m', external_id: null, template_id: null,
      raw_data: { source: 'training_block_manual_entry', mode: 'row', publication_shape: 'interval_distance' },
    })).toThrow(/fixed-distance or fixed-time/);
  });
});
