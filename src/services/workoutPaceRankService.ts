import { supabase } from './supabase';
import { workoutService } from './workoutService';
import { workoutIdentitySteps, type IdentityWorkout } from '../utils/workoutIdentity';
import { resolveWorkoutDurationSeconds } from '../utils/trainingBlockMatching';

const projection = 'id,workout_type,manual_rwn,distance_meters,duration_seconds,duration_minutes,raw_workout_type:raw_data->>workout_type,raw_intervals:raw_data->workout->intervals,raw_time:raw_data->time,raw_distance:raw_data->distance';
const pageSize = 250;

interface PaceRow extends Omit<IdentityWorkout, 'raw_workout'> {
    id: string;
    duration_minutes: number | null;
    raw_intervals: unknown;
    raw_time: number | null;
    raw_distance: number | null;
}

export interface PaceRankRequest {
    userId: string;
    workoutId: string;
    workPace: number;
    mainIndices: readonly number[] | null;
    signal: AbortSignal;
}

export interface WorkoutPaceRank {
    rank: number;
    attemptCount: number;
    percentile: number | null;
    tied: boolean;
    secondsOffBest: number;
}

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const rower = (type: string) => ['row', 'rower', 'rowerg'].includes(type.toLowerCase());
const toTenths = (seconds: number) => Math.round(Number(seconds.toFixed(1)) * 10);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function readAttempt(row: PaceRow, mainIndices: readonly number[] | null) {
    if (!rower(row.workout_type)) return null;
    const intervals = Array.isArray(row.raw_intervals) ? row.raw_intervals.filter(interval => !(isRecord(interval) && interval.type === 'rest')) : [];
    const seconds = positive(row.raw_time) ? row.raw_time / 10 : resolveWorkoutDurationSeconds(row);
    const distance = positive(row.raw_distance) ? row.raw_distance : row.distance_meters;
    const steps = workoutIdentitySteps({
        ...row, distance_meters: distance, duration_seconds: seconds, raw_workout: { intervals },
    });
    if (!steps || mainIndices?.length === 0) return null;

    let workDeciseconds = 0;
    let workMeters = 0;
    if (!intervals.length) {
        const step = steps[0];
        if (steps.length !== 1 || (mainIndices && (mainIndices.length !== 1 || mainIndices[0] !== 0)) ||
            !positive(seconds) || !positive(distance) ||
            (step.unit === 'distance' ? distance !== step.value : step.unit !== 'time' || seconds !== step.value)) return null;
        workDeciseconds = seconds * 10;
        workMeters = distance;
    } else {
        if (steps.length !== intervals.length || mainIndices?.some(index => index >= intervals.length)) return null;
        for (const [index, interval] of intervals.entries()) {
            if (!isRecord(interval) || !positive(interval.time) || !positive(interval.distance)) return null;
            const step = steps[index];
            const target = step.unit === 'time' ? interval.time / 10 : step.unit === 'distance' ? interval.distance : interval.calories_total;
            if (interval.type !== step.unit || target !== step.value ||
                (typeof interval.rest_time === 'number' && interval.rest_time / 10 !== step.rest)) return null;
            if (!mainIndices || mainIndices.includes(index)) {
                workDeciseconds += interval.time;
                workMeters += interval.distance;
            }
        }
    }
    const pace = (workDeciseconds / 10) * 500 / workMeters;
    if (!positive(pace)) return null;
    return { pace: toTenths(pace), identity: JSON.stringify(steps) };
}

export async function loadWorkoutPaceRank({ userId, workoutId, workPace, mainIndices, signal }: PaceRankRequest): Promise<WorkoutPaceRank | null> {
    if (!positive(workPace)) return null;
    const sources = [...workoutService.viewableSources];
    const { data: current, error } = await supabase.from('workout_logs').select(projection)
        .eq('user_id', userId).eq('id', workoutId).in('source', sources).abortSignal(signal).maybeSingle();
    if (error) throw error;
    const candidate = current && readAttempt(current as unknown as PaceRow, mainIndices);
    if (!candidate || candidate.pace !== toTenths(workPace)) return null;

    let faster = 0;
    let tied = 0;
    let slower = 0;
    let best = candidate.pace;
    let cursor: string | undefined;
    while (!signal.aborted) {
        let query = supabase.from('workout_logs').select(projection)
            .eq('user_id', userId).in('source', sources).ilike('workout_type', 'row%').neq('id', workoutId)
            .order('id').limit(pageSize).abortSignal(signal);
        if (cursor) query = query.gt('id', cursor);
        const { data, error: historyError } = await query;
        if (historyError) throw historyError;
        const rows = data as unknown as PaceRow[];
        for (const row of rows) {
            const attempt = readAttempt(row, mainIndices);
            if (attempt?.identity !== candidate.identity) continue;
            if (attempt.pace < candidate.pace) faster++;
            else if (attempt.pace === candidate.pace) tied++;
            else slower++;
            best = Math.min(best, attempt.pace);
        }
        if (rows.length < pageSize) {
            const others = faster + tied + slower;
            return {
                rank: faster + 1,
                attemptCount: others + 1,
                percentile: others >= 10 ? Math.floor(100 * slower / others) : null,
                tied: tied > 0,
                secondsOffBest: (candidate.pace - best) / 10,
            };
        }
        cursor = rows[rows.length - 1].id;
    }
    return null;
}
