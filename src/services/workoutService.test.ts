import { describe, expect, it } from 'vitest';
import type { C2Interval } from '../api/concept2.types';
import { deriveCanonicalNameFromIntervals } from '../utils/workoutCanonical';
import { buildManualWorkoutLogInsert, buildManualWorkoutLogUpdate, buildWorkoutDetailFromRow, buildWorkoutNameUpdates, formatWorkoutDurationSeconds, resolveConcept2Payload } from './workoutService';

describe('buildWorkoutDetailFromRow', () => {
    const columnsOnly = {
        id: 'db-uuid-1',
        user_id: 'user-1',
        workout_name: '[Development test] pm5_8x500m',
        workout_type: 'row',
        completed_at: '2026-09-21T19:00:00+00:00',
        distance_meters: 4000,
        duration_seconds: 960,
        source: 'manual',
        // Not the Concept2 shape: no date, distance, time or workout_type.
        raw_data: { completed_workout: {}, fixture_name: 'pm5_8x500m', source: 'fixture' },
    };

    it('reads measurements from columns when raw_data is not Concept2 shaped', () => {
        // These workouts rendered an invalid date and empty metrics because the
        // detail was built purely by spreading raw_data.
        const detail = buildWorkoutDetailFromRow(columnsOnly) as unknown as Record<string, unknown>;
        expect(detail.date).toBe('2026-09-21T19:00:00+00:00');
        expect(detail.distance).toBe(4000);
        expect(detail.workout_type).toBe('row');
    });

    it('converts the stored duration into the tenths of a second the view reads', () => {
        const detail = buildWorkoutDetailFromRow(columnsOnly) as unknown as Record<string, unknown>;
        expect(detail.time).toBe(9600);
    });

    it('still prefers Concept2 values when raw_data carries them', () => {
        const detail = buildWorkoutDetailFromRow({
            ...columnsOnly,
            raw_data: { date: '2026-09-20 07:30:00', distance: 2000, time: 4200, workout_type: 'FixedDistanceSplits' },
        }) as unknown as Record<string, unknown>;
        expect(detail.date).toBe('2026-09-20 07:30:00');
        expect(detail.distance).toBe(2000);
        expect(detail.time).toBe(4200);
        expect(detail.workout_type).toBe('FixedDistanceSplits');
    });

    it('keeps enrichment that only raw_data carries', () => {
        const detail = buildWorkoutDetailFromRow({
            ...columnsOnly,
            raw_data: {
                distance: 2000,
                workout: { intervals: [{ type: 'distance', distance: 500, time: 1200, stroke_rate: 30 }] },
                stroke_data: true,
            },
        }) as unknown as Record<string, unknown>;
        const workout = detail.workout as { intervals?: unknown[] };
        expect(workout?.intervals).toHaveLength(1);
        expect(detail.stroke_data).toBe(true);
    });

    it('builds a detail for a row with no raw_data at all', () => {
        // This previously threw, so such a workout could not be opened.
        const detail = buildWorkoutDetailFromRow({
            id: 'db-uuid-2',
            workout_name: '5000m',
            completed_at: '2026-09-22T06:00:00+00:00',
            distance_meters: 5000,
            duration_seconds: 1200,
        }) as unknown as Record<string, unknown>;
        expect(detail.distance).toBe(5000);
        expect(detail.time).toBe(12000);
        expect(detail.workout_name).toBe('5000m');
    });

    it('falls back to the database id when there is no external id', () => {
        const detail = buildWorkoutDetailFromRow(columnsOnly) as unknown as Record<string, unknown>;
        expect(detail.id).toBe('db-uuid-1');
        expect(detail.db_id).toBe('db-uuid-1');
    });

    it('prefers the external id so Concept2 links keep working', () => {
        const detail = buildWorkoutDetailFromRow({
            ...columnsOnly,
            external_id: '98765432',
        }) as unknown as Record<string, unknown>;
        expect(detail.id).toBe('98765432');
        expect(detail.db_id).toBe('db-uuid-1');
    });

    it('prefers the canonical name over the stored workout name', () => {
        const detail = buildWorkoutDetailFromRow({
            ...columnsOnly,
            canonical_name: '8x 500m',
        }) as unknown as Record<string, unknown>;
        expect(detail.workout_name).toBe('8x 500m');
    });

    it('treats a zero duration as present rather than missing', () => {
        const detail = buildWorkoutDetailFromRow({
            ...columnsOnly,
            duration_seconds: 0,
        }) as unknown as Record<string, unknown>;
        expect(detail.time).toBe(0);
    });
});

describe('buildWorkoutDetailFromRow with a published workout', () => {
    // Shape observed in stored data: workouts Logbook Companion publishes wrap
    // the submitted Concept2 payload rather than storing it at the top level.
    const published = {
        id: 'db-uuid-3',
        workout_name: '[Development test] pm5_8x500m',
        workout_type: 'row',
        completed_at: '2026-09-21T19:00:00+00:00',
        distance_meters: 4000,
        duration_seconds: 960,
        source: 'manual',
        raw_data: {
            fixture_name: 'pm5_8x500m',
            source: 'fixture',
            completed_workout: {
                shape: 'interval_distance',
                intervals: [{ kind: 'distance', distanceMeters: 500, workTimeSeconds: 120, restTimeSeconds: 210 }],
                concept2Payload: {
                    date: '2026-09-21 15:00:00',
                    distance: 4000,
                    time: 9600,
                    workout_type: 'FixedDistanceInterval',
                    stroke_rate: 30,
                    workout: {
                        intervals: [
                            { type: 'distance', distance: 500, time: 1200, rest_time: 2100, stroke_rate: 30 },
                            { type: 'distance', distance: 500, time: 1200, rest_time: 2100, stroke_rate: 30 },
                        ],
                    },
                    stroke_data: [{ t: 10, d: 25 }],
                },
            },
        },
    };

    it('recovers the interval structure from the nested payload', () => {
        // Reading only the top level flattened an eight by five hundred piece
        // into a single four thousand metre row, losing every split.
        const detail = buildWorkoutDetailFromRow(published) as unknown as Record<string, unknown>;
        const workout = detail.workout as { intervals?: unknown[] };
        expect(workout?.intervals).toHaveLength(2);
    });

    it('recovers the interval workout type rather than reporting a flat row', () => {
        const detail = buildWorkoutDetailFromRow(published) as unknown as Record<string, unknown>;
        expect(detail.workout_type).toBe('FixedDistanceInterval');
    });

    it('still reports the correct totals', () => {
        const detail = buildWorkoutDetailFromRow(published) as unknown as Record<string, unknown>;
        expect(detail.distance).toBe(4000);
        expect(detail.time).toBe(9600);
        expect(detail.date).toBe('2026-09-21 15:00:00');
    });

    it('does not mistake the wrapper for a Concept2 payload', () => {
        const detail = buildWorkoutDetailFromRow(published) as unknown as Record<string, unknown>;
        expect(detail.fixture_name).toBeUndefined();
    });

    it('yields intervals a canonical name can be derived from', () => {
        // Without the structure the piece read as a flat row, so history and
        // template matching saw a 4000m row rather than an 8x500m session.
        const eightIntervals = Array.from({ length: 8 }, () => ({
            type: 'distance', distance: 500, time: 1200, rest_time: 2100, stroke_rate: 30,
        }));
        const detail = buildWorkoutDetailFromRow({
            ...published,
            raw_data: {
                completed_workout: {
                    concept2Payload: {
                        date: '2026-09-21 15:00:00',
                        distance: 4000,
                        time: 9600,
                        workout_type: 'FixedDistanceInterval',
                        workout: { intervals: eightIntervals },
                    },
                },
            },
        }) as unknown as Record<string, unknown>;

        const intervals = (detail.workout as { intervals: C2Interval[] }).intervals;
        expect(intervals).toHaveLength(8);
        expect(deriveCanonicalNameFromIntervals(intervals)).toBe(
            deriveCanonicalNameFromIntervals(eightIntervals as unknown as C2Interval[]),
        );
        expect(deriveCanonicalNameFromIntervals(intervals)).not.toBeNull();
    });
});

describe('resolveConcept2Payload', () => {
    it('returns a top-level payload unchanged', () => {
        const raw = { date: '2026-09-20 07:30:00', distance: 2000, time: 4200 };
        expect(resolveConcept2Payload(raw)).toBe(raw);
    });

    it('recognises a top-level payload by its intervals alone', () => {
        const raw = { workout: { intervals: [{ type: 'distance', distance: 500, time: 1200, stroke_rate: 30 }] } };
        expect(resolveConcept2Payload(raw)).toBe(raw);
    });

    it('unwraps a published workout', () => {
        const nested = { date: '2026-09-21 15:00:00', distance: 4000, time: 9600 };
        expect(resolveConcept2Payload({ completed_workout: { concept2Payload: nested } })).toBe(nested);
    });

    it('falls back to the stored data when nothing is wrapped', () => {
        const raw = { fixture_name: 'x', source: 'fixture' };
        expect(resolveConcept2Payload(raw)).toBe(raw);
    });

    it('handles absent data', () => {
        expect(resolveConcept2Payload(null)).toBeNull();
    });
});

describe('resolveConcept2Payload for workouts never published to Concept2', () => {
    // Shape observed in stored data: intervals recorded in Logbook Companion's
    // own vocabulary, with no Concept2 payload to fall back on.
    const unpublished = {
        completed_workout: {
            shape: { kind: 'fixed_time_interval' },
            completedAt: '2026-09-21T18:00:00.000Z',
            distanceMeters: 1440,
            workTimeSeconds: 360,
            restTimeSeconds: 90,
            intervals: [
                { kind: 'time', distanceMeters: 480, workTimeSeconds: 120, restTimeSeconds: 45, restDistanceMeters: 0 },
                { kind: 'time', distanceMeters: 480, workTimeSeconds: 120, restTimeSeconds: 45, restDistanceMeters: 0 },
                { kind: 'time', distanceMeters: 480, workTimeSeconds: 120, restTimeSeconds: 0, restDistanceMeters: 0 },
            ],
        },
    };

    it('translates the recorded intervals rather than reporting a flat piece', () => {
        const payload = resolveConcept2Payload(unpublished);
        const intervals = payload?.workout?.intervals as unknown as Record<string, unknown>[];
        expect(intervals).toHaveLength(3);
        expect(intervals[0].type).toBe('time');
        expect(intervals[0].distance).toBe(480);
    });

    it('converts seconds into the tenths the Concept2 shape uses', () => {
        const payload = resolveConcept2Payload(unpublished);
        const intervals = payload?.workout?.intervals as unknown as Record<string, unknown>[];
        expect(intervals[0].time).toBe(1200);
        expect(intervals[0].rest_time).toBe(450);
        expect(payload?.time).toBe(3600);
    });

    it('maps the recorded shape onto a Concept2 workout type', () => {
        expect(resolveConcept2Payload(unpublished)?.workout_type).toBe('FixedTimeInterval');
        expect(resolveConcept2Payload({
            completed_workout: {
                shape: { kind: 'variable_interval' },
                intervals: [{ kind: 'distance', distanceMeters: 500, workTimeSeconds: 120, restTimeSeconds: 30, restDistanceMeters: 25 }],
            },
        })?.workout_type).toBe('VariableInterval');
    });

    it('carries rest distance for variable intervals', () => {
        const payload = resolveConcept2Payload({
            completed_workout: {
                shape: { kind: 'variable_interval' },
                intervals: [{ kind: 'distance', distanceMeters: 500, workTimeSeconds: 120, restTimeSeconds: 30, restDistanceMeters: 25 }],
            },
        });
        const intervals = payload?.workout?.intervals as unknown as Record<string, unknown>[];
        expect(intervals[0].rest_distance).toBe(25);
    });

    it('leaves data alone when there are no intervals to translate', () => {
        // A training block quick completion genuinely has no structure.
        const raw = { mode: 'row', source: 'quick_completion' };
        expect(resolveConcept2Payload(raw)).toBe(raw);
    });
});

describe('buildWorkoutNameUpdates', () => {
    it('normalizes a manual RWN override into canonical matching metadata', () => {
        expect(buildWorkoutNameUpdates({ manualRWN: '  4x500m/1:00r  ' })).toEqual({
            manual_rwn: '4x500m/1:00r',
            canonical_name: '4x500m/1:00r',
            canonical_signature: '4x500m/1:00r',
            template_id: null,
            match_confidence: null,
            match_reason: null,
        });
    });

    it('clears manual RWN without replacing existing canonical metadata when the override is blank', () => {
        expect(buildWorkoutNameUpdates({ manualRWN: '   ' })).toEqual({
            manual_rwn: null,
        });
    });

    it('can update benchmark state independently', () => {
        expect(buildWorkoutNameUpdates({ isBenchmark: true })).toEqual({
            is_benchmark: true,
        });
    });
});


describe('formatWorkoutDurationSeconds', () => {
    it('prefers duration_seconds and falls back to rounded duration_minutes', () => {
        expect(formatWorkoutDurationSeconds(1800, 31)).toBe('30:00');
        expect(formatWorkoutDurationSeconds(null, 30.5)).toBe('30:30');
        expect(formatWorkoutDurationSeconds(undefined, undefined)).toBe('-');
    });
});

describe('buildManualWorkoutLogInsert', () => {
    it('creates canonical metadata for deliberate manual rowing entries', () => {
        const insert = buildManualWorkoutLogInsert({
            userId: 'user-1',
            completedAt: '2026-07-06T16:00:00.000Z',
            mode: 'row',
            manualRWN: '  8x500m/3:30r  ',
            distanceMeters: 4000,
            durationSeconds: 1800,
            avgSplit500m: 225,
            perceivedExertion: 7,
            plannedWeekNumber: 1,
            plannedDaySlot: 0,
            plannedSessionKey: 'mon_8x500-primary',
        });

        expect(insert).toMatchObject({
            user_id: 'user-1',
            completed_at: '2026-07-06T16:00:00.000Z',
            source: 'manual',
            workout_type: 'row',
            workout_name: '8x500m/3:30r',
            manual_rwn: '8x500m/3:30r',
            canonical_name: '8x500m/3:30r',
            canonical_signature: '8x500m/3:30r',
            distance_meters: 4000,
            duration_seconds: 1800,
            duration_minutes: 30,
            avg_split_500m: 225,
            perceived_exertion: 7,
            notes: '[tb:slot:0] [tb:session:mon_8x500-primary]',
        });
        expect(insert.raw_data).toMatchObject({
            source: 'training_block_manual_entry',
            mode: 'row',
            planned_week_number: 1,
            planned_day_slot: 0,
            planned_session_key: 'mon_8x500-primary',
            avg_split_500m: 225,
        });
    });


    it('builds editable manual workout updates without changing ownership fields', () => {
        const update = buildManualWorkoutLogUpdate({
            userId: 'user-1',
            completedAt: '2026-07-06T17:30:00.000Z',
            mode: 'row',
            manualRWN: '8x500m/3:30r',
            distanceMeters: 4100,
            durationSeconds: 1810,
            avgSplit500m: 220.7,
            perceivedExertion: 8,
            notes: 'Edited after review',
            plannedWeekNumber: 1,
            plannedDaySlot: 0,
            plannedSessionKey: 'mon_8x500-primary',
        });

        expect(update).toMatchObject({
            completed_at: '2026-07-06T17:30:00.000Z',
            source: 'manual',
            workout_type: 'row',
            distance_meters: 4100,
            duration_seconds: 1810,
            avg_split_500m: 220.7,
            perceived_exertion: 8,
            notes: 'Edited after review [tb:slot:0] [tb:session:mon_8x500-primary]',
        });
        expect(update).not.toHaveProperty('user_id');
        expect(update.raw_data).toMatchObject({
            planned_session_key: 'mon_8x500-primary',
            avg_split_500m: 220.7,
        });
    });

    it('allows strength/support completion without lossy canonical RWN', () => {
        const insert = buildManualWorkoutLogInsert({
            userId: 'user-1',
            completedAt: '2026-07-08T16:00:00.000Z',
            mode: 'strength',
            distanceMeters: 5000,
            durationSeconds: 2400,
            manualRWN: '5000m',
            notes: 'Push routine complete',
            plannedWeekNumber: 1,
            plannedDaySlot: 2,
        });

        expect(insert).toMatchObject({
            source: 'manual',
            workout_name: 'Strength work',
            workout_type: 'strength',
            manual_rwn: null,
            canonical_name: null,
            canonical_signature: null,
            distance_meters: null,
            duration_seconds: 2400,
            duration_minutes: 40,
            notes: 'Push routine complete [tb:slot:2] [tb:strength:completed]',
        });
    });

    it('marks quick training block completions so checkbox mistakes can be reversed', () => {
        const insert = buildManualWorkoutLogInsert({
            userId: 'user-1',
            completedAt: '2026-07-08T16:00:00.000Z',
            mode: 'strength',
            notes: 'Strength (push) complete',
            plannedWeekNumber: 1,
            plannedDaySlot: 2,
            plannedSessionKey: 'wed_strength_push-support',
            trainingBlockQuickCompletionKey: 'strength-push',
        });

        expect(insert.notes).toBe('Strength (push) complete [tb:slot:2] [tb:session:wed_strength_push-support] [tb:strength:completed] [tb:quick:strength-push]');
        expect(insert.raw_data).toMatchObject({
            planned_session_key: 'wed_strength_push-support',
            training_block_quick_completion_key: 'strength-push',
        });
    });

    it('marks support-prep quick completions without pretending they are strength work', () => {
        const insert = buildManualWorkoutLogInsert({
            userId: 'user-1',
            completedAt: '2026-07-08T16:00:00.000Z',
            mode: 'support',
            notes: 'Support prep complete',
            plannedWeekNumber: 1,
            plannedDaySlot: 2,
            trainingBlockQuickCompletionKey: 'support-prep',
        });

        expect(insert.notes).toBe('Support prep complete [tb:slot:2] [tb:quick:support-prep]');
        expect(insert.workout_type).toBe('support');
        expect(insert.raw_data).toMatchObject({
            training_block_quick_completion_key: 'support-prep',
        });
    });
});
