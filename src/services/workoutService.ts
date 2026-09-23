import { supabase } from './supabase';
import type { C2Interval, C2ResultDetail, C2Stroke } from '../api/concept2.types';
import { deriveCanonicalNameFromIntervals, deriveCanonicalNameFromRWN, normalizeCanonicalName } from '../utils/workoutCanonical';
import { resolveWorkoutDurationSeconds } from '../utils/trainingBlockMatching';
import { getTotalTrainingDistanceMeters } from '../utils/workoutDistance';
import { autoCompleteAssignmentFromErgLinkLog } from './coaching/coachingService';
import type { Database, Json } from '../types/database.types';

type WorkoutLogRow = Database['public']['Tables']['workout_logs']['Row'];
type WorkoutLogInsert = Database['public']['Tables']['workout_logs']['Insert'];
type WorkoutLogUpdate = Database['public']['Tables']['workout_logs']['Update'];

export type ManualWorkoutLogMode = 'row' | 'cross_training' | 'strength' | 'support';

export interface ManualWorkoutLogInput {
    userId: string;
    completedAt: string;
    mode: ManualWorkoutLogMode;
    manualRWN?: string | null;
    distanceMeters?: number | null;
    durationSeconds?: number | null;
    avgSplit500m?: number | null;
    perceivedExertion?: number | null;
    notes?: string | null;
    plannedWeekNumber?: number | null;
    plannedDaySlot?: number | null;
    plannedSessionKey?: string | null;
    trainingBlockQuickCompletionKey?: string | null;
}


interface WorkoutRawData extends Record<string, unknown> {
    group_assignment_id?: string;
    time_formatted?: string;
    workout?: {
        intervals?: C2Interval[];
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toWorkoutRawData(value: Json | null): WorkoutRawData | null {
    if (!isRecord(value)) return null;
    return value as WorkoutRawData;
}

function hasWorkoutIntervals(raw: WorkoutRawData | null): raw is WorkoutRawData & { workout: { intervals: C2Interval[] } } {
    return Array.isArray(raw?.workout?.intervals);
}

/** An interval as Logbook Companion records it before any Concept2 translation. */
interface CompletedWorkoutInterval {
    kind?: string;
    distanceMeters?: number;
    workTimeSeconds?: number;
    restTimeSeconds?: number;
    restDistanceMeters?: number;
}

const COMPLETED_SHAPE_TO_CONCEPT2_TYPE: Record<string, string> = {
    fixed_distance_interval: 'FixedDistanceInterval',
    interval_distance: 'FixedDistanceInterval',
    fixed_time_interval: 'FixedTimeInterval',
    interval_time: 'FixedTimeInterval',
    variable_interval: 'VariableInterval',
};

/**
 * Translate Logbook Companion's own interval record into the Concept2 shape.
 *
 * Workouts that were never published to Concept2 have no Concept2 payload to
 * fall back on, but they do record their intervals in their own vocabulary.
 * Without translating them an interval session read as a single flat piece,
 * so it showed no splits and produced no structure to derive a canonical name
 * from, which is what made history and template matching treat repeats of the
 * same session as unrelated rows.
 *
 * Durations are seconds here and tenths of a second in the Concept2 shape.
 */
function concept2PayloadFromCompletedWorkout(completed: Record<string, unknown>): WorkoutRawData | null {
    const intervals = completed.intervals;
    if (!Array.isArray(intervals) || intervals.length === 0) return null;

    const mapped: C2Interval[] = intervals.map((entry) => {
        const interval = (isRecord(entry) ? entry : {}) as CompletedWorkoutInterval;
        return {
            type: interval.kind === 'time' ? 'time' : 'distance',
            distance: Math.round(interval.distanceMeters ?? 0),
            time: Math.round((interval.workTimeSeconds ?? 0) * 10),
            rest_time: Math.round((interval.restTimeSeconds ?? 0) * 10),
            ...(interval.restDistanceMeters ? { rest_distance: Math.round(interval.restDistanceMeters) } : {}),
        } as unknown as C2Interval;
    });

    const shape = isRecord(completed.shape) ? String(completed.shape.kind ?? '') : '';

    return {
        ...(completed.completedAt ? { date: completed.completedAt } : {}),
        ...(typeof completed.distanceMeters === 'number' ? { distance: completed.distanceMeters } : {}),
        ...(typeof completed.workTimeSeconds === 'number'
            ? { time: Math.round(completed.workTimeSeconds * 10) }
            : {}),
        ...(typeof completed.restDistanceMeters === 'number'
            ? { rest_distance: completed.restDistanceMeters }
            : {}),
        ...(typeof completed.restTimeSeconds === 'number'
            ? { rest_time: Math.round(completed.restTimeSeconds * 10) }
            : {}),
        ...(COMPLETED_SHAPE_TO_CONCEPT2_TYPE[shape]
            ? { workout_type: COMPLETED_SHAPE_TO_CONCEPT2_TYPE[shape] }
            : {}),
        workout: { intervals: mapped },
    };
}

/**
 * Find the Concept2-shaped payload inside stored workout data.
 *
 * Imported results and PM5 captures put that payload at the top level. Workouts
 * Logbook Companion publishes itself wrap it, storing the submitted payload
 * under `completed_workout.concept2Payload`. Workouts that were never published
 * have no such payload, so their own interval record is translated instead.
 *
 * Looking only at the top level lost the interval structure for both, so an
 * eight by five hundred piece was read as a flat four thousand metre row.
 */
export function resolveConcept2Payload(raw: WorkoutRawData | null): WorkoutRawData | null {
    if (!raw) return null;
    if (hasWorkoutIntervals(raw) || raw.distance !== undefined || raw.date !== undefined) return raw;

    const completed = isRecord(raw.completed_workout) ? raw.completed_workout : null;
    if (!completed) return raw;

    if (isRecord(completed.concept2Payload)) return completed.concept2Payload as WorkoutRawData;

    return concept2PayloadFromCompletedWorkout(completed) ?? raw;
}

/** The workout columns the analysis view needs, however the workout was recorded. */
export interface WorkoutDetailRow extends Record<string, unknown> {
    id: string;
    user_id?: string | null;
    external_id?: string | null;
    workout_name?: string | null;
    canonical_name?: string | null;
    workout_type?: string | null;
    completed_at?: string | null;
    distance_meters?: number | null;
    rest_distance_meters?: number | null;
    duration_seconds?: number | string | null;
    average_stroke_rate?: number | null;
    watts?: number | null;
    template_id?: string | null;
    manual_rwn?: string | null;
    source?: string | null;
    raw_data?: Json | null;
}

function firstPresent(...values: unknown[]): unknown {
    return values.find(value => value !== undefined && value !== null);
}

/**
 * Build the shape the analysis view reads from a stored workout.
 *
 * Columns are authoritative and `raw_data` only enriches. `raw_data` holds the
 * full Concept2 payload for imported results and the Concept2 projection for
 * captured ones, but workouts recorded by other paths store an unrelated shape
 * with no date, distance or time in it. Spreading `raw_data` and reading those
 * fields straight off it left every metric undefined for those workouts, so the
 * detail view showed an invalid date and empty measurements while the list,
 * which reads the columns, was correct.
 *
 * Enrichment that only `raw_data` carries, such as intervals and stroke data,
 * is preserved by spreading it first.
 */
export function buildWorkoutDetailFromRow(row: WorkoutDetailRow): C2ResultDetail {
    const stored = toWorkoutRawData(row.raw_data ?? null);
    const raw = resolveConcept2Payload(stored);
    const rawFields: Record<string, unknown> = raw ?? {};

    let canonicalName = row.canonical_name;
    if (!canonicalName && hasWorkoutIntervals(raw)) {
        canonicalName = deriveCanonicalNameFromIntervals(raw.workout.intervals) || canonicalName;
    }
    if (!canonicalName) canonicalName = row.workout_name;

    const rawId = rawFields.id;
    const rawUserId = rawFields.user_id;

    // The view reads `time` in tenths of a second, matching Concept2, while the
    // column stores whole seconds.
    const columnTimeTenths = row.duration_seconds === undefined || row.duration_seconds === null
        ? undefined
        : Math.round(Number(row.duration_seconds) * 10);

    return {
        ...rawFields,
        id: typeof rawId === 'string' || typeof rawId === 'number'
            ? rawId
            : row.external_id ?? row.id,
        user_id: typeof rawUserId === 'string' || typeof rawUserId === 'number'
            ? rawUserId
            : row.user_id,
        db_id: row.id,
        date: firstPresent(rawFields.date, row.completed_at),
        distance: firstPresent(rawFields.distance, row.distance_meters),
        time: firstPresent(rawFields.time, columnTimeTenths),
        rest_distance: firstPresent(rawFields.rest_distance, row.rest_distance_meters),
        workout_type: firstPresent(rawFields.workout_type, row.workout_type),
        stroke_rate: firstPresent(rawFields.stroke_rate, row.average_stroke_rate),
        watts: firstPresent(rawFields.watts, row.watts),
        workout_name: canonicalName, // Inject Canonical Name for UI consistency
        template_id: row.template_id, // Include linked template ID
        manual_rwn: row.manual_rwn, // Include manual RWN override
        is_benchmark: row.is_benchmark, // Include benchmark flag
        source: row.source,
    } as unknown as C2ResultDetail;
}

export const formatWorkoutDurationSeconds = (durationSeconds?: number | null, durationMinutes?: number | null) => {
    const resolvedSeconds = resolveWorkoutDurationSeconds({
        duration_seconds: durationSeconds,
        duration_minutes: durationMinutes,
    });

    if (!resolvedSeconds) return '-';

    const roundedSeconds = Math.round(resolvedSeconds);
    const hours = Math.floor(roundedSeconds / 3600);
    const minutes = Math.floor((roundedSeconds % 3600) / 60);
    const seconds = roundedSeconds % 60;

    if (hours > 0) {
        return hours + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }

    return minutes + ':' + seconds.toString().padStart(2, '0');
};

function formatCanonicalDuration(durationSeconds?: number | null, durationMinutes?: number | null): string {
    const resolvedSeconds = resolveWorkoutDurationSeconds({
        duration_seconds: durationSeconds,
        duration_minutes: durationMinutes,
    });

    return resolvedSeconds ? formatWorkoutDurationSeconds(resolvedSeconds) : '0:00';
}


function trimToNull(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function finitePositiveNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function manualModeLabel(mode: ManualWorkoutLogMode): string {
    const labels: Record<ManualWorkoutLogMode, string> = {
        row: 'Manual rowing workout',
        cross_training: 'Cross-training',
        strength: 'Strength work',
        support: 'Support work',
    };
    return labels[mode];
}

function buildManualNotes(input: ManualWorkoutLogInput): string | null {
    const notes = trimToNull(input.notes);
    const markers: string[] = [];

    if (input.plannedDaySlot === 0 || input.plannedDaySlot) {
        markers.push(`[tb:slot:${input.plannedDaySlot}]`);
    }
    if (input.plannedSessionKey) {
        markers.push(`[tb:session:${input.plannedSessionKey}]`);
    }
    if (input.mode === 'strength') {
        markers.push('[tb:strength:completed]');
    }
    if (input.trainingBlockQuickCompletionKey) {
        markers.push(`[tb:quick:${input.trainingBlockQuickCompletionKey}]`);
    }

    return [notes, ...markers].filter(Boolean).join(' ') || null;
}

function buildManualWorkoutLogPayload(input: ManualWorkoutLogInput): WorkoutLogInsert {
    const supportsDistance = input.mode === 'row' || input.mode === 'cross_training';
    const supportsRWN = input.mode === 'row' || input.mode === 'cross_training';
    const manualRWN = supportsRWN ? trimToNull(input.manualRWN) : null;
    const canonicalName = deriveCanonicalNameFromRWN(manualRWN);
    const durationSeconds = finitePositiveNumber(input.durationSeconds);
    const avgSplit500m = input.mode === 'row' ? finitePositiveNumber(input.avgSplit500m) : null;
    const distanceMeters = supportsDistance ? finitePositiveNumber(input.distanceMeters) : null;
    const perceivedExertion = finitePositiveNumber(input.perceivedExertion);
    const modeLabel = manualModeLabel(input.mode);

    return {
        user_id: input.userId,
        completed_at: input.completedAt,
        source: 'manual',
        workout_name: canonicalName || modeLabel,
        workout_type: input.mode,
        manual_rwn: manualRWN,
        canonical_name: canonicalName,
        canonical_signature: normalizeCanonicalName(canonicalName),
        distance_meters: distanceMeters,
        duration_seconds: durationSeconds,
        duration_minutes: durationSeconds ? durationSeconds / 60 : null,
        avg_split_500m: avgSplit500m,
        perceived_exertion: perceivedExertion,
        notes: buildManualNotes(input),
        raw_data: {
            source: 'training_block_manual_entry',
            mode: input.mode,
            planned_week_number: input.plannedWeekNumber ?? null,
            planned_day_slot: input.plannedDaySlot ?? null,
            planned_session_key: input.plannedSessionKey ?? null,
            avg_split_500m: avgSplit500m,
            training_block_quick_completion_key: input.trainingBlockQuickCompletionKey ?? null,
        },
    };
}

export function buildManualWorkoutLogInsert(input: ManualWorkoutLogInput): WorkoutLogInsert {
    return buildManualWorkoutLogPayload(input);
}

export function buildManualWorkoutLogUpdate(input: ManualWorkoutLogInput): WorkoutLogUpdate {
    const payload = buildManualWorkoutLogPayload(input);
    const { user_id: _userId, created_at: _createdAt, id: _id, ...updates } = payload;
    return updates;
}



export async function updateManualWorkoutLog(workoutId: string, input: ManualWorkoutLogInput): Promise<WorkoutLogRow> {
    const payload = buildManualWorkoutLogUpdate(input);
    const { data, error } = await supabase
        .from('workout_logs')
        .update(payload)
        .eq('id', workoutId)
        .eq('user_id', input.userId)
        .eq('source', 'manual')
        .select('*')
        .single();

    if (error) throw error;
    return data as WorkoutLogRow;
}

export async function deleteManualWorkoutLog(workoutId: string, userId: string): Promise<void> {
    const { error } = await supabase
        .from('workout_logs')
        .delete()
        .eq('id', workoutId)
        .eq('user_id', userId)
        .eq('source', 'manual');

    if (error) throw error;
}

export function buildWorkoutNameUpdates(payload: { manualRWN?: string; isBenchmark?: boolean }): Record<string, unknown> {
    const updates: Record<string, unknown> = {};

    if (payload.manualRWN !== undefined) {
        const manualRWN = payload.manualRWN.trim();
        updates.manual_rwn = manualRWN || null;

        const canonicalName = deriveCanonicalNameFromRWN(manualRWN);
        if (canonicalName) {
            updates.canonical_name = canonicalName;
            updates.canonical_signature = normalizeCanonicalName(canonicalName);
            updates.template_id = null;
            updates.match_confidence = null;
            updates.match_reason = null;
        }
    }

    if (payload.isBenchmark !== undefined) updates.is_benchmark = payload.isBenchmark;

    return updates;
}

export const workoutService = {
    // Sources visible to dashboard/analysis views
    // Includes ErgLink live uploads so coaching-related pages can surface them.
    viewableSources: ['concept2', 'erg_link_live', 'manual'] as const,

    createManualWorkoutLog: async (input: ManualWorkoutLogInput): Promise<WorkoutLogRow> => {
        const payload = buildManualWorkoutLogInsert(input);
        const { data, error } = await supabase
            .from('workout_logs')
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;
        return data as WorkoutLogRow;
    },

    updateManualWorkoutLog,
    deleteManualWorkoutLog,

    // Fetch recent workouts list (Dashboard)
    getRecentWorkouts: async (limit = 50, page = 0) => {
        const from = page * limit;
        const to = from + limit - 1;

        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .in('source', [...workoutService.viewableSources])
            .order('completed_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        const logs = ((data ?? []) as WorkoutLogRow[]);

        const autoLinkTasks = logs
            .filter((log) => log.source === 'erg_link_live' && !!log.id && !!log.user_id && !!log.raw_data)
            .map((log) => {
                const raw = toWorkoutRawData(log.raw_data);
                const groupAssignmentId = raw?.group_assignment_id;
                if (!groupAssignmentId) return null;

                return autoCompleteAssignmentFromErgLinkLog({
                    workoutLogId: log.id,
                    userId: log.user_id,
                    completedAt: log.completed_at,
                    groupAssignmentId,
                });
            })
            .filter(Boolean) as Promise<void>[];

        if (autoLinkTasks.length > 0) {
            await Promise.allSettled(autoLinkTasks);
        }

        return logs.map(log => {
            const raw = toWorkoutRawData(log.raw_data);
            // DB is Primary Source
            // Try to use DB canonical name, fallback to calculating it, then fallback to DB workout name
            let canonicalName = log.canonical_name;

            // 1. Manual Override Check (New Feature)
            if (log.manual_rwn) {
                const generated = deriveCanonicalNameFromRWN(log.manual_rwn);
                if (generated) canonicalName = generated;
            }
            // 2. Auto-Detection (Legacy / Default)
            // If missing OR "Unstructured", try to generate from raw (and backfill)
            else if ((!canonicalName || canonicalName === 'Unstructured') && hasWorkoutIntervals(raw)) {
                const generated = deriveCanonicalNameFromIntervals(raw.workout.intervals);
                if (generated) {
                    canonicalName = generated;
                    // Fire & Forget update
                    supabase.from('workout_logs').update({
                        canonical_name: canonicalName,
                        canonical_signature: normalizeCanonicalName(canonicalName),
                    }).eq('id', log.id).then();
                }
            }

            // Fallbacks — workout_name holds C2 workout_type (e.g. 'FixedDistanceSplits') due to column swap in DB
            if (!canonicalName) {
                if (log.workout_name === 'FixedDistanceSplits' || log.workout_name === 'FixedDistanceNoSplits') canonicalName = `${log.distance_meters ?? 0}m`;
                else if (log.workout_name === 'FixedTimeSplits' || log.workout_name === 'FixedTimeNoSplits') canonicalName = formatCanonicalDuration(log.duration_seconds, log.duration_minutes);
                else if (log.workout_name === 'JustRow') canonicalName = 'Just Row';
                else canonicalName = log.workout_name;
            }

            const durationSeconds = resolveWorkoutDurationSeconds({
                duration_seconds: log.duration_seconds,
                duration_minutes: log.duration_minutes,
            });
            const timeFormatted = raw?.time_formatted ?? formatWorkoutDurationSeconds(log.duration_seconds, log.duration_minutes);

            return {
                id: log.external_id ?? log.id, // Use C2 ID for compatibility when present
                db_id: log.id, // Keep internal DB ID accessible
                date: log.completed_at,
                distance: log.distance_meters ?? 0,
                totalDistance: getTotalTrainingDistanceMeters(log),
                durationSeconds,
                time: durationSeconds ? durationSeconds * 10 : 0,
                time_formatted: timeFormatted,
                type: log.workout_type,
                name: canonicalName,
                watts: log.watts ?? undefined,
                stroke_rate: log.average_stroke_rate ?? undefined,
                calories_total: log.calories_burned ?? undefined,
                raw_data: raw
            };
        });
    },

    // Fetch single workout detail (Analysis)
    getWorkoutDetail: async (idOrExternalId: string | number) => {
        const idStr = String(idOrExternalId);
        // Check if UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

        const query = supabase
            .from('workout_logs')
            .select('*');

        if (isUUID) {
            query.eq('id', idStr);
        } else {
            query.eq('external_id', idStr);
        }

        const { data, error } = await query.single();

        if (error) throw error;

        return buildWorkoutDetailFromRow(data);
    },

    // Fetch strokes (Analysis)
    getStrokes: async (idOrExternalId: string | number) => {
        const idStr = String(idOrExternalId);
        // Check if UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

        const query = supabase
            .from('workout_logs')
            .select('raw_data');

        if (isUUID) {
            query.eq('id', idStr);
        } else {
            query.eq('external_id', idStr);
        }

        const { data, error } = await query.single();

        if (error) throw error;

        // Published workouts nest their Concept2 payload, so stroke data is not
        // at the top level for them.
        const raw = resolveConcept2Payload(toWorkoutRawData(data.raw_data ?? null));
        const strokes = raw?.strokes ?? raw?.stroke_data;

        return Array.isArray(strokes) ? strokes as C2Stroke[] : [];
    },

    // Fetch Power Buckets (Analysis)
    getPowerBuckets: async (idOrExternalId: string | number) => {
        const idStr = String(idOrExternalId);
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

        let workoutId = idStr;

        // If External ID, we need to resolve to Internal ID first (or join)
        // Since buckets are keyed by Internal ID.
        if (!isUUID) {
            const { data, error } = await supabase
                .from('workout_logs')
                .select('id')
                .eq('external_id', idStr)
                .single();
            if (error || !data) return null;
            workoutId = data.id;
        }

        try {
            const { data, error } = await supabase
                .from('workout_power_distribution')
                .select('buckets')
                .eq('workout_id', workoutId)
                .maybeSingle();

            if (error) {
                // Gracefully handle RLS/404/406 errors
                if (error.code === 'PGRST116' || error.message?.includes('406') || error.message?.includes('Not Acceptable')) {
                    return null;
                }
                console.error('Error fetching power buckets:', error);
                return null;
            }

            return data?.buckets as Record<string, number> || null;
        } catch (err) {
            console.error('Exception fetching power buckets:', err);
            return null;
        }
    },

    // Fetch history of a specific workout type (Progress)
    getWorkoutHistory: async (workoutName: string) => {
        // We use canonical_name now for precise filtering
        // If DB is not fully backfilled, this might miss old records until they are viewed in dashboard.
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('canonical_name', workoutName)
            .order('completed_at', { ascending: false }); // Most recent first

        if (error) throw error;

        return data.map(log => ({
            id: log.external_id || log.id,
            db_id: log.id,
            date: log.completed_at,
            watts: log.watts,
            distance: log.distance_meters,
            time: resolveWorkoutDurationSeconds({ duration_seconds: log.duration_seconds, duration_minutes: log.duration_minutes }) ?? 0,
            avg_split: log.avg_split_500m
        }));
    },

    // Fetch and aggregate power buckets for multiple workouts (Analytics)
    getAggregatedPowerBuckets: async (workoutIds: string[]): Promise<Record<string, number>> => {
        if (workoutIds.length === 0) return {};

        const { data, error } = await supabase
            .from('workout_power_distribution')
            .select('buckets')
            .in('workout_id', workoutIds);

        if (error) {
            console.error('Error fetching aggregated buckets:', error);
            return {};
        }

        // Merge all buckets
        const aggregated: Record<string, number> = {};
        data.forEach(row => {
            if (row.buckets) {
                Object.entries(row.buckets).forEach(([watts, seconds]) => {
                    aggregated[watts] = (aggregated[watts] || 0) + (seconds as number);
                });
            }
        });

        return aggregated;
    },

    // Search Workouts (Dashboard + Comparison Picker)
    searchWorkouts: async (term: string) => {
        const trimmed = term.trim();
        if (!trimmed) return [];

        const escaped = trimmed.replaceAll(',', '\\,');

        const { data, error } = await supabase
            .from('workout_logs')
            .select('id, external_id, completed_at, workout_name, distance_meters, rest_distance_meters, duration_seconds, duration_minutes, canonical_name, manual_rwn, source')
            .in('source', [...workoutService.viewableSources])
            .or(`workout_name.ilike.%${escaped}%,canonical_name.ilike.%${escaped}%,manual_rwn.ilike.%${escaped}%`)
            .order('completed_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        return data.map(log => ({
            id: log.external_id || log.id,
            db_id: log.id,
            date: log.completed_at,
            name: log.canonical_name || log.workout_name,
            distance: log.distance_meters,
            totalDistance: getTotalTrainingDistanceMeters(log),
            durationSeconds: resolveWorkoutDurationSeconds({
                duration_seconds: log.duration_seconds,
                duration_minutes: log.duration_minutes,
            }),
            time_formatted: formatWorkoutDurationSeconds(log.duration_seconds, log.duration_minutes),
            manual_rwn: log.manual_rwn
        }));
    },

    // Get "Smart" comparison options (PR, Previous) for a specific workout
    getSimilarWorkouts: async (targetId: string) => {
        // 1. Get Target Workout
        const target = await workoutService.getWorkoutDetail(targetId);
        if (!target) throw new Error("Target workout not found");

        const canonicalName = target.workout_name || '';

        // 2. Get History
        const history = await workoutService.getWorkoutHistory(canonicalName);

        // 3. Find PR (Best Watts implies best pace usually, or lowest time for distance)
        // Sort by Watts Descending (Power PR)
        // Or if Time/Distance type, sort by Splits?
        // Let's use Watts as a universal "Best Effort" proxy for now, or Split.
        const pr = [...history].sort((a, b) => (b.watts || 0) - (a.watts || 0))[0];

        // 4. Find Previous (Most recent before this one)
        // History is sorted by Date Ascending.
        // Find index of target (using db_id or external_id)
        const targetIndex = history.findIndex(h => h.id === target.id || h.db_id === target.id); // target.id from getDetail is external_id?
        // Wait, getDetail returns C2ResultDetail, which doesn't have `id` or `db_id` at top level easily?
        // Actually getDetail returns the spread raw_data + `workout_name`. 
        // We might need to ensure we have the ID to match.

        let previous = null;
        if (targetIndex > 0) {
            previous = history[targetIndex - 1];
        }

        return {
            target,
            pr: pr?.id !== target.id ? pr : null, // Don't suggest itself if it IS the PR
            previous,
            history
        };
    },

    // Update workout naming metadata (Manual Override)
    updateWorkoutName: async (id: string, payload: { manualRWN?: string; isBenchmark?: boolean }) => {
        const updates = buildWorkoutNameUpdates(payload);

        const { error } = await supabase
            .from('workout_logs')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    // Link a workout to a template
    linkWorkoutToTemplate: async (workoutId: string, templateId: string | null, matchMeta?: { match_confidence?: number; match_reason?: string }) => {
        const updates: Record<string, unknown> = { template_id: templateId };
        if (matchMeta?.match_confidence !== undefined) updates.match_confidence = matchMeta.match_confidence;
        if (matchMeta?.match_reason) updates.match_reason = matchMeta.match_reason;

        const { data, error } = await supabase
            .from('workout_logs')
            .update(updates)
            .eq('id', workoutId)
            .select();

        if (error) {
            console.error('Failed to link workout to template:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.error('No rows updated - workout may not exist or RLS policy blocking update');
            throw new Error('Failed to update workout - no rows affected');
        }

        return data[0];
    },

    savePowerDistribution: async (workoutId: string, buckets: Record<string, number>) => {
        const { error } = await supabase
            .from('workout_power_distribution')
            .upsert({
                workout_id: workoutId,
                buckets: buckets
            });

        if (error) {
            console.error('Error saving power buckets:', error);
            throw error;
        }
    },

    // Fetch Steady State Workouts (Analysis)
    getSteadyStateHistory: async () => {
        // Fetch all potential steady state candidates
        // We filter by client-side types for flexibility, or could do IN query
        const { data, error } = await supabase
            .from('workout_logs')
            .select('id, external_id, completed_at, workout_name, workout_type, distance_meters, duration_seconds, duration_minutes, watts, average_stroke_rate, average_heart_rate, canonical_name')
            .in('source', [...workoutService.viewableSources])
            .order('completed_at', { ascending: false });

        if (error) throw error;

        return data.map(log => ({
            id: log.id,
            external_id: log.external_id,
            date: log.completed_at,
            name: log.canonical_name || log.workout_name,
            type: log.workout_name, // Map to workout_name because that holds the C2 type (JustRow, etc)
            distance: log.distance_meters,
            time: resolveWorkoutDurationSeconds({ duration_seconds: log.duration_seconds, duration_minutes: log.duration_minutes }) ?? 0,
            watts: log.watts,
            rate: log.average_stroke_rate,
            hr: log.average_heart_rate,
            is_benchmark: log.canonical_name?.includes('#test') || false
        }));
    }
};
