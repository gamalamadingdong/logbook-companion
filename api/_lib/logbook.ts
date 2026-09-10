// Server-side Logbook data access for the ChatGPT MCP connector.
//
// This module is intentionally self-contained and MUST NOT import from `src/`:
// the app's Supabase client reads `import.meta.env` and is browser-scoped. Here
// we use the service-role key and hard-scope every query to a single athlete
// (LOGBOOK_USER_ID), because the MCP connector is a personal, read-only tool.
//
// SECURITY: the service-role key bypasses RLS. Per-user scoping therefore lives
// in code (`.eq('user_id', userId)`), not in the database. This shape is only
// safe for a single-athlete deployment. Do NOT expose it multi-user without
// switching to per-user OAuth + passing the user JWT so RLS does the scoping.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Sources considered "real training" for analysis surfaces. Mirrors
// workoutService.viewableSources in the app.
const VIEWABLE_SOURCES = ['concept2', 'erg_link_live', 'manual'] as const;

export interface LogbookConfig {
    supabaseUrl: string;
    serviceRoleKey: string;
    userId: string;
    bearerToken: string;
}

export function readConfig(): LogbookConfig {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const userId = process.env.LOGBOOK_USER_ID ?? '';
    const bearerToken = process.env.MCP_BEARER_TOKEN ?? '';

    const missing = [
        !supabaseUrl && 'SUPABASE_URL',
        !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
        !userId && 'LOGBOOK_USER_ID',
        !bearerToken && 'MCP_BEARER_TOKEN',
    ].filter(Boolean) as string[];

    if (missing.length > 0) {
        throw new Error(`Missing required env vars for MCP connector: ${missing.join(', ')}`);
    }

    return { supabaseUrl, serviceRoleKey, userId, bearerToken };
}

let cachedClient: SupabaseClient | null = null;

function getClient(cfg: LogbookConfig): SupabaseClient {
    if (!cachedClient) {
        cachedClient = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return cachedClient;
}

// The subset of columns we expose. Keep this narrow and stable.
const WORKOUT_COLUMNS = [
    'id',
    'external_id',
    'source',
    'workout_type',
    'workout_name',
    'canonical_name',
    'completed_at',
    'distance_meters',
    'duration_seconds',
    'duration_minutes',
    'avg_split_500m',
    'watts',
    'average_heart_rate',
    'max_heart_rate',
    'average_stroke_rate',
    'calories_burned',
    'training_zone',
    'perceived_exertion',
    'rating',
    'notes',
].join(', ');

export interface WorkoutRow {
    id: string;
    external_id: string | null;
    source: string | null;
    workout_type: string;
    workout_name: string;
    canonical_name: string | null;
    completed_at: string;
    distance_meters: number | null;
    duration_seconds: number | null;
    duration_minutes: number | null;
    avg_split_500m: number | null;
    watts: number | null;
    average_heart_rate: number | null;
    max_heart_rate: number | null;
    average_stroke_rate: number | null;
    calories_burned: number | null;
    training_zone: string | null;
    perceived_exertion: number | null;
    rating: number | null;
    notes: string | null;
}

function durationSeconds(row: WorkoutRow): number {
    if (row.duration_seconds && row.duration_seconds > 0) return row.duration_seconds;
    if (row.duration_minutes && row.duration_minutes > 0) return row.duration_minutes * 60;
    return 0;
}

export interface SearchFilters {
    startDate?: string;
    endDate?: string;
    workoutType?: string;
    trainingZone?: string;
    source?: string;
    nameContains?: string;
    minDistanceMeters?: number;
    maxDistanceMeters?: number;
    minDurationSeconds?: number;
    maxDurationSeconds?: number;
    order?: 'newest' | 'oldest';
    limit?: number;
}

export async function searchWorkouts(cfg: LogbookConfig, filters: SearchFilters): Promise<WorkoutRow[]> {
    const client = getClient(cfg);
    let query = client
        .from('workout_logs')
        .select(WORKOUT_COLUMNS)
        .eq('user_id', cfg.userId)
        .in('source', [...VIEWABLE_SOURCES]);

    if (filters.startDate) query = query.gte('completed_at', filters.startDate);
    if (filters.endDate) query = query.lte('completed_at', filters.endDate);
    if (filters.workoutType) query = query.eq('workout_type', filters.workoutType);
    if (filters.trainingZone) query = query.eq('training_zone', filters.trainingZone);
    if (filters.source) query = query.eq('source', filters.source);
    if (filters.nameContains) query = query.ilike('canonical_name', `%${filters.nameContains}%`);
    if (typeof filters.minDistanceMeters === 'number') query = query.gte('distance_meters', filters.minDistanceMeters);
    if (typeof filters.maxDistanceMeters === 'number') query = query.lte('distance_meters', filters.maxDistanceMeters);

    query = query.order('completed_at', { ascending: filters.order === 'oldest' });
    query = query.limit(Math.min(Math.max(filters.limit ?? 50, 1), 500));

    const { data, error } = await query;
    if (error) throw new Error(`searchWorkouts: ${error.message}`);

    let rows = (data ?? []) as unknown as WorkoutRow[];

    // Duration filters applied in JS because duration lives across two columns.
    if (typeof filters.minDurationSeconds === 'number') {
        rows = rows.filter((r) => durationSeconds(r) >= filters.minDurationSeconds!);
    }
    if (typeof filters.maxDurationSeconds === 'number') {
        rows = rows.filter((r) => durationSeconds(r) <= filters.maxDurationSeconds!);
    }

    return rows;
}

export async function getWorkoutDetail(cfg: LogbookConfig, idOrExternalId: string): Promise<Record<string, unknown> | null> {
    const client = getClient(cfg);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrExternalId);

    let query = client
        .from('workout_logs')
        .select(`${WORKOUT_COLUMNS}, raw_data`)
        .eq('user_id', cfg.userId);
    query = isUUID ? query.eq('id', idOrExternalId) : query.eq('external_id', idOrExternalId);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`getWorkoutDetail: ${error.message}`);
    if (!data) return null;

    const row = data as unknown as WorkoutRow & { raw_data?: unknown };
    // Surface interval structure when present, without dumping stroke-by-stroke data.
    const raw = row.raw_data as { workout?: { intervals?: unknown[] }; time_formatted?: string } | null;
    const intervals = raw?.workout?.intervals ?? null;

    return {
        ...row,
        duration_seconds: durationSeconds(row),
        raw_data: undefined,
        intervals,
        time_formatted: raw?.time_formatted ?? null,
    };
}

export interface TrainingSummary {
    period: { start: string | null; end: string | null };
    sessionCount: number;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    totalCalories: number;
    avgHeartRate: number | null;
    byType: Record<string, { sessions: number; distanceMeters: number; durationSeconds: number }>;
    byZone: Record<string, { sessions: number; distanceMeters: number; durationSeconds: number }>;
    bySource: Record<string, number>;
}

function emptyBucket() {
    return { sessions: 0, distanceMeters: 0, durationSeconds: 0 };
}

export function summarize(rows: WorkoutRow[], start?: string, end?: string): TrainingSummary {
    const byType: TrainingSummary['byType'] = {};
    const byZone: TrainingSummary['byZone'] = {};
    const bySource: TrainingSummary['bySource'] = {};

    let totalDistance = 0;
    let totalDuration = 0;
    let totalCalories = 0;
    let hrSum = 0;
    let hrCount = 0;

    for (const r of rows) {
        const dist = r.distance_meters ?? 0;
        const dur = durationSeconds(r);
        totalDistance += dist;
        totalDuration += dur;
        totalCalories += r.calories_burned ?? 0;
        if (typeof r.average_heart_rate === 'number' && r.average_heart_rate > 0) {
            hrSum += r.average_heart_rate;
            hrCount += 1;
        }

        const typeKey = r.workout_type || 'unknown';
        byType[typeKey] ??= emptyBucket();
        byType[typeKey].sessions += 1;
        byType[typeKey].distanceMeters += dist;
        byType[typeKey].durationSeconds += dur;

        const zoneKey = r.training_zone || 'unspecified';
        byZone[zoneKey] ??= emptyBucket();
        byZone[zoneKey].sessions += 1;
        byZone[zoneKey].distanceMeters += dist;
        byZone[zoneKey].durationSeconds += dur;

        const srcKey = r.source || 'unknown';
        bySource[srcKey] = (bySource[srcKey] ?? 0) + 1;
    }

    return {
        period: { start: start ?? null, end: end ?? null },
        sessionCount: rows.length,
        totalDistanceMeters: totalDistance,
        totalDurationSeconds: totalDuration,
        totalCalories,
        avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
        byType,
        byZone,
        bySource,
    };
}

export async function getTrainingSummary(cfg: LogbookConfig, start?: string, end?: string, workoutType?: string): Promise<TrainingSummary> {
    const rows = await searchWorkouts(cfg, { startDate: start, endDate: end, workoutType, limit: 500 });
    return summarize(rows, start, end);
}

export interface BenchmarkEntry {
    date: string;
    canonical_name: string | null;
    distance_meters: number | null;
    duration_seconds: number;
    avg_split_500m: number | null;
    watts: number | null;
    average_heart_rate: number | null;
}

export async function getBenchmarkHistory(cfg: LogbookConfig, benchmark: string, limit = 50): Promise<BenchmarkEntry[]> {
    // Benchmarks are identified by canonical_name (e.g. "2000m", "5000m", "30:00").
    const client = getClient(cfg);
    const { data, error } = await client
        .from('workout_logs')
        .select(WORKOUT_COLUMNS)
        .eq('user_id', cfg.userId)
        .in('source', [...VIEWABLE_SOURCES])
        .ilike('canonical_name', benchmark)
        .order('completed_at', { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 200));

    if (error) throw new Error(`getBenchmarkHistory: ${error.message}`);

    return ((data ?? []) as unknown as WorkoutRow[]).map((r) => ({
        date: r.completed_at,
        canonical_name: r.canonical_name,
        distance_meters: r.distance_meters,
        duration_seconds: durationSeconds(r),
        avg_split_500m: r.avg_split_500m,
        watts: r.watts,
        average_heart_rate: r.average_heart_rate,
    }));
}

export interface TrendPoint {
    weekStart: string; // ISO date (Monday)
    sessions: number;
    distanceMeters: number;
    durationSeconds: number;
    avgWatts: number | null;
    avgHeartRate: number | null;
}

function isoWeekStart(dateStr: string): string {
    const d = new Date(dateStr);
    const day = (d.getUTCDay() + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

export async function getWeeklyTrend(cfg: LogbookConfig, start?: string, end?: string, workoutType?: string): Promise<TrendPoint[]> {
    const rows = await searchWorkouts(cfg, { startDate: start, endDate: end, workoutType, order: 'oldest', limit: 500 });

    const buckets = new Map<string, { sessions: number; dist: number; dur: number; wattsSum: number; wattsN: number; hrSum: number; hrN: number }>();
    for (const r of rows) {
        const wk = isoWeekStart(r.completed_at);
        const b = buckets.get(wk) ?? { sessions: 0, dist: 0, dur: 0, wattsSum: 0, wattsN: 0, hrSum: 0, hrN: 0 };
        b.sessions += 1;
        b.dist += r.distance_meters ?? 0;
        b.dur += durationSeconds(r);
        if (typeof r.watts === 'number' && r.watts > 0) { b.wattsSum += r.watts; b.wattsN += 1; }
        if (typeof r.average_heart_rate === 'number' && r.average_heart_rate > 0) { b.hrSum += r.average_heart_rate; b.hrN += 1; }
        buckets.set(wk, b);
    }

    return [...buckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([weekStart, b]) => ({
            weekStart,
            sessions: b.sessions,
            distanceMeters: b.dist,
            durationSeconds: b.dur,
            avgWatts: b.wattsN > 0 ? Math.round(b.wattsSum / b.wattsN) : null,
            avgHeartRate: b.hrN > 0 ? Math.round(b.hrSum / b.hrN) : null,
        }));
}

export interface PeriodComparison {
    periodA: TrainingSummary;
    periodB: TrainingSummary;
    deltas: {
        sessionCount: number;
        totalDistanceMeters: number;
        totalDurationSeconds: number;
        avgHeartRate: number | null;
    };
}

export async function compareTrainingPeriods(
    cfg: LogbookConfig,
    a: { start: string; end: string },
    b: { start: string; end: string },
    workoutType?: string,
): Promise<PeriodComparison> {
    const [rowsA, rowsB] = await Promise.all([
        searchWorkouts(cfg, { startDate: a.start, endDate: a.end, workoutType, limit: 500 }),
        searchWorkouts(cfg, { startDate: b.start, endDate: b.end, workoutType, limit: 500 }),
    ]);
    const periodA = summarize(rowsA, a.start, a.end);
    const periodB = summarize(rowsB, b.start, b.end);

    return {
        periodA,
        periodB,
        deltas: {
            sessionCount: periodB.sessionCount - periodA.sessionCount,
            totalDistanceMeters: periodB.totalDistanceMeters - periodA.totalDistanceMeters,
            totalDurationSeconds: periodB.totalDurationSeconds - periodA.totalDurationSeconds,
            avgHeartRate:
                periodA.avgHeartRate !== null && periodB.avgHeartRate !== null
                    ? periodB.avgHeartRate - periodA.avgHeartRate
                    : null,
        },
    };
}

export async function listBenchmarks(cfg: LogbookConfig): Promise<Array<{ canonical_name: string; count: number }>> {
    const client = getClient(cfg);
    const { data, error } = await client
        .from('workout_logs')
        .select('canonical_name')
        .eq('user_id', cfg.userId)
        .in('source', [...VIEWABLE_SOURCES])
        .not('canonical_name', 'is', null)
        .limit(2000);

    if (error) throw new Error(`listBenchmarks: ${error.message}`);

    const counts = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ canonical_name: string | null }>) {
        if (!r.canonical_name) continue;
        counts.set(r.canonical_name, (counts.get(r.canonical_name) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([canonical_name, count]) => ({ canonical_name, count }))
        .sort((a, b) => b.count - a.count);
}
