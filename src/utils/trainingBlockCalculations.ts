import { WEEK_TARGETS_M } from '../data/rowingTrainingBlockTemplate';
import type {
    TrainingBlockActualLogEvent,
    TrainingBlockDayCategory,
    TrainingBlockDaySummary,
    TrainingBlockKeySessionCredit,
    TrainingBlockPlannedDay,
    TrainingBlockPlan,
    TrainingBlockStrengthStatus,
    TrainingBlockWeekSummary,
    TrainingBlockWorkoutStatus,
} from '../types/trainingBlock.types';

const DEFAULT_NO_LOG_STATUS: TrainingBlockWorkoutStatus = 'as_written';
const DAY_MS = 24 * 60 * 60 * 1000;

type DayAlignmentMode = 'date' | 'slot';

export type LogAlignmentMode = DayAlignmentMode;

type PlanDayBucket = {
    day: TrainingBlockPlannedDay;
    plannedDayKey: string;
};

type WeekBuckets = {
    week: number;
    days: PlanDayBucket[];
    byDate: Map<string, PlanDayBucket>;
    bySlot: Map<number, PlanDayBucket>;
    fillBySlot: Map<number, number>;
    fillLimitBySlot: Map<number, number>;
};

function toNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeDate(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value.slice(0, 10);
    }

    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsed.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDay(dateString: string): number {
    return new Date(`${dateString}T12:00:00`).getTime();
}

function daySlotToKey(weekNumber: number, daySlot: number): string {
    return `${weekNumber}:${daySlot}`;
}

function resolveDaySlotHint(log: TrainingBlockActualLogEvent): number | null {
    if (log.planned_day_slot === 0 || log.planned_day_slot) {
        if (log.planned_day_slot < 0 || log.planned_day_slot > 6) {
            return null;
        }

        return log.planned_day_slot;
    }

    return null;
}

function normalizeLog(log: TrainingBlockActualLogEvent): TrainingBlockActualLogEvent {
    return {
        ...log,
        date: normalizeDate(log.date),
    };
}

function estimateLogCategory(log: TrainingBlockActualLogEvent): TrainingBlockDayCategory {
    if (log.source === 'concept2') return 'erg';

    const normalized = `${log.workout_name ?? ''} ${log.workout_type ?? ''} ${log.notes ?? ''}`.toLowerCase();
    if (normalized.includes('strength') || normalized.includes('lift') || normalized.includes('squat') || normalized.includes('deadlift') || normalized.includes('press')) {
        return 'cross_training';
    }
    if (normalized.includes('bike') || normalized.includes('ski') || normalized.includes('run') || normalized.includes('cross')) {
        return 'cross_training';
    }

    return 'erg';
}

function isCompatibleCategory(day: TrainingBlockPlannedDay, category: TrainingBlockDayCategory): boolean {
    if (day.category === 'rest') return false;
    if (category === 'erg') {
        if (day.category === 'erg') return true;
        return day.sessions.some((session) => session.source === 'erg');
    }

    if (category === 'cross_training') {
        if (day.category === 'cross_training') return true;
        return day.sessions.some((session) => session.source === 'cross_training' || session.source === 'strength');
    }

    return false;
}

function buildWeekBuckets(plan: TrainingBlockPlan): Map<number, WeekBuckets> {
    const buckets = new Map<number, WeekBuckets>();

    for (const day of plan.days) {
        const slots = buckets.get(day.week_number);
        const bucket: PlanDayBucket = {
            day,
            plannedDayKey: daySlotToKey(day.week_number, day.day_slot),
        };

        if (slots) {
            slots.days.push(bucket);
            slots.byDate.set(day.date, bucket);
            slots.bySlot.set(day.day_slot, bucket);
            slots.fillLimitBySlot.set(day.day_slot, Math.max(1, day.sessions.length));
            slots.fillBySlot.set(day.day_slot, 0);
            continue;
        }

        buckets.set(day.week_number, {
            week: day.week_number,
            days: [bucket],
            byDate: new Map([[day.date, bucket]]),
            bySlot: new Map([[day.day_slot, bucket]]),
            fillBySlot: new Map([[day.day_slot, 0]]),
            fillLimitBySlot: new Map([[day.day_slot, Math.max(1, day.sessions.length)]]),
        });
    }

    return buckets;
}

function resolveWeekNumber(planStartDate: string, logDate: string): number | null {
    const planStart = parseLocalDay(planStartDate);
    const logStart = parseLocalDay(logDate);
    const offset = Math.floor((logStart - planStart) / DAY_MS);

    if (!Number.isFinite(offset)) return null;
    if (offset < 0) return null;

    const computed = Math.floor(offset / 7) + 1;
    return computed;
}

function sortByAffinity(
    day: PlanDayBucket,
    logCategory: TrainingBlockDayCategory,
    fillBySlot: Map<number, number>,
    fillLimitBySlot: Map<number, number>,
): number {
    const hasCompatibility = isCompatibleCategory(day.day, logCategory) ? 0 : 1;
    const slotFill = fillBySlot.get(day.day.day_slot) ?? 0;
    const slotCap = fillLimitBySlot.get(day.day.day_slot) ?? 1;
    const utilization = slotCap > 0 ? slotFill / slotCap : 0;
    return hasCompatibility * 100 + utilization;
}

function assignLogToBucket(
    buckets: Map<string, TrainingBlockActualLogEvent[]>,
    mode: DayAlignmentMode,
    log: TrainingBlockActualLogEvent,
    plannedBucket: PlanDayBucket,
): void {
    const key = mode === 'slot' ? plannedBucket.plannedDayKey : plannedBucket.day.date;
    const entries = buckets.get(key);
    const normalized = {
        ...log,
        planned_week_number: plannedBucket.day.week_number,
        planned_day_slot: plannedBucket.day.day_slot,
        planned_day_key: plannedBucket.plannedDayKey,
        date: plannedBucket.day.date,
    };

    if (entries) {
        entries.push(normalized);
    } else {
        buckets.set(key, [normalized]);
    }
}

export function alignLogsToPlanDays(
    plan: TrainingBlockPlan,
    logs: readonly TrainingBlockActualLogEvent[] = [],
    mode: DayAlignmentMode = 'slot',
): Map<string, TrainingBlockActualLogEvent[]> {
    const bucketsByPlanDate = new Map<string, TrainingBlockActualLogEvent[]>();
    const weekBuckets = buildWeekBuckets(plan);

    const pending = new Map<number, TrainingBlockActualLogEvent[]>();

    for (const rawLog of logs.map(normalizeLog)) {
        const weekNumber = rawLog.planned_week_number
            ?? resolveWeekNumber(plan.start_date, rawLog.date);

        if (!weekNumber || !weekBuckets.has(weekNumber)) {
            continue;
        }

        const plannedBuckets = weekBuckets.get(weekNumber);
        if (!plannedBuckets) continue;

        const hintSlot = resolveDaySlotHint(rawLog);
        if (hintSlot !== null) {
            const hinted = plannedBuckets.bySlot.get(hintSlot);
            if (hinted) {
                assignLogToBucket(bucketsByPlanDate, mode, rawLog, hinted);
                const next = plannedBuckets.fillBySlot.get(hintSlot);
                if (typeof next === 'number') {
                    plannedBuckets.fillBySlot.set(hintSlot, next + 1);
                }
                continue;
            }
        }

        const existingByDate = plannedBuckets.byDate.get(rawLog.date);
        if (existingByDate) {
            assignLogToBucket(bucketsByPlanDate, mode, rawLog, existingByDate);
            const next = plannedBuckets.fillBySlot.get(existingByDate.day.day_slot);
            if (typeof next === 'number') {
                plannedBuckets.fillBySlot.set(existingByDate.day.day_slot, next + 1);
            }
            continue;
        }

        const list = pending.get(weekNumber);
        if (list) {
            list.push(rawLog);
        } else {
            pending.set(weekNumber, [rawLog]);
        }
    }

    for (const [weekNumber, weekPendingLogs] of pending) {
        const plannedBuckets = weekBuckets.get(weekNumber);
        if (!plannedBuckets) continue;

        const sortedByDate = [...weekPendingLogs].sort((a, b) => {
            const aTs = parseLocalDay(a.date);
            const bTs = parseLocalDay(b.date);
            if (aTs !== bTs) return aTs - bTs;
            return 0;
        });

        for (const log of sortedByDate) {
            const normalizedCategory = estimateLogCategory(log);
            const orderedByAffinity = [...plannedBuckets.days]
                .filter((bucket) => bucket.day.category !== 'rest')
                .sort((a, b) => {
                    const aScore = sortByAffinity(a, normalizedCategory, plannedBuckets.fillBySlot, plannedBuckets.fillLimitBySlot);
                    const bScore = sortByAffinity(b, normalizedCategory, plannedBuckets.fillBySlot, plannedBuckets.fillLimitBySlot);
                    if (aScore !== bScore) return aScore - bScore;
                    if (a.day.day_slot !== b.day.day_slot) return a.day.day_slot - b.day.day_slot;
                    return 0;
                });

            let target = orderedByAffinity[0] ?? plannedBuckets.days[0];

            if (!target) {
                continue;
            }

            // Prefer slots still under nominal capacity.
            const underCapacity = orderedByAffinity.find((entry) => {
                const slotFill = plannedBuckets.fillBySlot.get(entry.day.day_slot) ?? 0;
                const slotCap = plannedBuckets.fillLimitBySlot.get(entry.day.day_slot) ?? 1;
                return slotFill < slotCap;
            });
            if (underCapacity) {
                target = underCapacity;
            }

            assignLogToBucket(bucketsByPlanDate, mode, log, target);
            const nextFill = plannedBuckets.fillBySlot.get(target.day.day_slot);
            if (typeof nextFill === 'number') {
                plannedBuckets.fillBySlot.set(target.day.day_slot, nextFill + 1);
            }
        }
    }

    if (mode === 'slot') {
        // Sort each bucket so the newest displays stay stable when rendered.
        for (const bucket of bucketsByPlanDate.values()) {
            bucket.sort((a, b) => {
                const aTs = parseLocalDay(a.date);
                const bTs = parseLocalDay(b.date);
                return aTs - bTs;
            });
        }
    }

    return bucketsByPlanDate;
}

export function calculateTrainingLoad(distanceMeters: number | null | undefined, perceivedExertion: number | null | undefined): number | null {
    const distance = toNumber(distanceMeters);
    const rpe = toNumber(perceivedExertion);

    if (distance <= 0 || rpe <= 0) return null;
    if (rpe < 1 || rpe > 10) return null;

    const distanceKm = distance / 1000;
    return Number((distanceKm * rpe).toFixed(2));
}

export function plannedDistanceMetersForDay(day: TrainingBlockPlannedDay): number {
    return day.sessions.reduce((sum, session) => {
        if (!session.counts_toward_weekly_volume) return sum;
        return sum + toNumber(session.expected_distance_meters);
    }, 0);
}

function getPrimaryDistanceFromLogs(logs: readonly TrainingBlockActualLogEvent[]): number {
    return logs.reduce((sum, log) => sum + toNumber(log.distance_meters), 0);
}

function getLogStrengthStatus(logs: readonly TrainingBlockActualLogEvent[]): TrainingBlockStrengthStatus {
    const strengthLog = logs.find((log) => log.strength_status);
    if (!strengthLog?.strength_status) return 'not_scheduled';
    return strengthLog.strength_status;
}

function deriveDayStatus(
    day: TrainingBlockPlannedDay,
    logs: readonly TrainingBlockActualLogEvent[],
    plannedDistance: number,
    actualDistance: number,
): TrainingBlockWorkoutStatus {
    if (day.category === 'rest') return 'as_written';

    const explicitStatus = logs
        .map((log) => log.status)
        .find((status): status is TrainingBlockWorkoutStatus => Boolean(status));

    if (explicitStatus) return explicitStatus;

    if (logs.length === 0) return DEFAULT_NO_LOG_STATUS;

    if (plannedDistance > 0) {
        const ratio = actualDistance / plannedDistance;
        return ratio >= 0.9 ? 'modified' : ratio > 0 ? 'partial' : DEFAULT_NO_LOG_STATUS;
    }

    return DEFAULT_NO_LOG_STATUS;
}

function deriveKeySessionCredit(
    day: TrainingBlockPlannedDay,
    logs: readonly TrainingBlockActualLogEvent[],
    plannedDistance: number,
    actualDistance: number,
): TrainingBlockKeySessionCredit {
    const explicitCredit = logs
        .map((log) => log.key_session_credit)
        .find((credit): credit is TrainingBlockKeySessionCredit => Boolean(credit));

    if (explicitCredit) {
        return explicitCredit;
    }

    const hasKeySession = day.sessions.some((session) => session.is_key_session);
    if (!hasKeySession) return 'n_a';
    if (plannedDistance <= 0) return 'n_a';
    if (actualDistance <= 0) return 'no';

    const ratio = actualDistance / plannedDistance;
    if (ratio >= 0.95) return 'yes';
    return ratio > 0.15 ? 'partial' : 'no';
}

export function summarizeDayProgress(
    day: TrainingBlockPlannedDay,
    logs: readonly TrainingBlockActualLogEvent[] = [],
): TrainingBlockDaySummary {
    const plannedDistance = plannedDistanceMetersForDay(day);
    const actualDistance = getPrimaryDistanceFromLogs(logs);
    const status = deriveDayStatus(day, logs, plannedDistance, actualDistance);
    const keySessionCredit = deriveKeySessionCredit(day, logs, plannedDistance, actualDistance);
    const strengthStatus = getLogStrengthStatus(logs);
    const trainingLoad = logs.reduce(
        (sum, log) => sum + (calculateTrainingLoad(log.distance_meters, log.perceived_exertion) ?? 0),
        0,
    );

    return {
        planned_day_slot: day.day_slot,
        date: day.date,
        week_number: day.week_number,
        category: day.category,
        planned_distance_meters: plannedDistance,
        actual_distance_meters: actualDistance,
        status,
        key_session_credit: keySessionCredit,
        strength_status: trainingLoad > 0
            ? strengthStatus === 'not_scheduled'
                ? 'not_started'
                : strengthStatus
            : strengthStatus === 'not_scheduled'
                ? 'not_scheduled'
                : strengthStatus,
        training_load: trainingLoad > 0 ? Number(trainingLoad.toFixed(2)) : null,
        logged_session_count: logs.length,
    };
}

function keySessionValue(credit: TrainingBlockKeySessionCredit): number {
    if (credit === 'yes') return 1;
    if (credit === 'partial') return 0.5;
    return 0;
}

function findTargetDistanceForWeek(weekNumber: number): number {
    return WEEK_TARGETS_M.find((target) => target.week_number === weekNumber)?.target_distance_meters ?? 0;
}

export function summarizeWeekProgress(
    plan: TrainingBlockPlan,
    logs: readonly TrainingBlockActualLogEvent[] = [],
    mode: DayAlignmentMode = 'slot',
): TrainingBlockWeekSummary[] {
    const byDayKey = alignLogsToPlanDays(plan, logs, mode);

    const summariesByWeek: Record<number, TrainingBlockDaySummary[]> = {};
    for (const day of plan.days) {
        const key = mode === 'slot' ? daySlotToKey(day.week_number, day.day_slot) : day.date;
        const daySummary = summarizeDayProgress(day, byDayKey.get(key) ?? []);
        const byWeek = summariesByWeek[day.week_number];
        if (byWeek) {
            byWeek.push(daySummary);
        } else {
            summariesByWeek[day.week_number] = [daySummary];
        }
    }

    return Object.keys(summariesByWeek)
        .map(Number)
        .sort((a, b) => a - b)
        .map((weekNumber) => {
            const daySummaries = summariesByWeek[weekNumber];
            const plannedDistance = daySummaries.reduce((sum, day) => sum + day.planned_distance_meters, 0);
            const actualDistance = daySummaries.reduce((sum, day) => sum + day.actual_distance_meters, 0);
            const targetDistance = findTargetDistanceForWeek(weekNumber);
            const possibleKeySessions = plan.days
                .filter((day) => day.week_number === weekNumber)
                .reduce((sum, day) => {
                    return sum + day.sessions.filter((session) => session.is_key_session).length;
                }, 0);

            const earnedCredit = daySummaries.reduce(
                (sum, day) => sum + keySessionValue(day.key_session_credit),
                0,
            );
            const partialCredits = daySummaries.filter((day) => day.key_session_credit === 'partial').length;

            return {
                week_number: weekNumber,
                planned_distance_meters: plannedDistance,
                target_distance_meters: targetDistance,
                actual_distance_meters: actualDistance,
                target_coverage_ratio:
                    targetDistance > 0 ? clampPercent(actualDistance / targetDistance) : 0,
                delta_to_target_meters: actualDistance - targetDistance,
                key_session_credits: {
                    possible: possibleKeySessions,
                    earned: earnedCredit,
                    partial: partialCredits,
                },
                key_session_complete: possibleKeySessions > 0
                    ? earnedCredit >= possibleKeySessions
                    : false,
                day_summaries: daySummaries,
            };
        });
}

function clampPercent(value: number): number {
    return Math.max(0, Math.min(value, 1));
}
