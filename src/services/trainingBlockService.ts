import { supabase } from './supabase';
import { formatKilometerLabel } from '../utils/trainingBlockFormatting';
import type { Database } from '../types/database.types';
import type {
    TrainingBlockLinkedWorkoutTemplate,
} from '../utils/trainingBlockTemplateValidation';
import type { TrainingBlockMatchingContext } from '../utils/trainingBlockMatching';
import type {
    TrainingBlockDayCategory,
    TrainingBlockIntervalSpec,
    TrainingBlockKeySessionCredit,
    TrainingBlockPlan,
    TrainingBlockPlannedDay,
    TrainingBlockPlannedSession,
    TrainingBlockReferenceContent,
    TrainingBlockSessionRole,
    TrainingBlockSessionSource,
    TrainingBlockStrengthStatus,
    TrainingBlockSupportPrescription,
    TrainingBlockTemplateKey,
    TrainingBlockWorkoutFamily,
    TrainingBlockWorkoutStatus,
} from '../types/trainingBlock.types';

export type TrainingBlockTemplateRow = Database['public']['Tables']['training_block_templates']['Row'];
export type TrainingBlockTemplateDayRow = Database['public']['Tables']['training_block_template_days']['Row'];
export type TrainingBlockTemplateSessionRow = Database['public']['Tables']['training_block_template_sessions']['Row'];
export type TrainingBlockEnrollmentRow = Database['public']['Tables']['training_block_enrollments']['Row'];
export type TrainingBlockEnrollmentInsert = Database['public']['Tables']['training_block_enrollments']['Insert'];
export type TrainingBlockLogReviewRow = Database['public']['Tables']['training_block_log_reviews']['Row'];
export type TrainingBlockLogReviewInsert = Database['public']['Tables']['training_block_log_reviews']['Insert'];
export type TrainingBlockLogReviewUpdate = Database['public']['Tables']['training_block_log_reviews']['Update'];

export interface EnsureTrainingBlockEnrollmentInput {
    userId: string;
    templateKey: TrainingBlockTemplateKey;
    startDate: string;
    endDate: string;
    isActive: boolean;
    templateId?: string | null;
}

export interface BuildTrainingBlockLogReviewInput {
    enrollmentId: string;
    userId: string;
    workoutLogId: string;
    plannedWeekNumber?: number | null;
    plannedDaySlot?: number | null;
    plannedSessionKey?: string | null;
    status?: TrainingBlockWorkoutStatus | null;
    keySessionCredit?: TrainingBlockKeySessionCredit | null;
    strengthStatus?: TrainingBlockStrengthStatus | null;
    notes?: string | null;
}

export interface TrainingBlockReviewOverride {
    status?: TrainingBlockWorkoutStatus;
    key_session_credit?: TrainingBlockKeySessionCredit;
    strength_status?: TrainingBlockStrengthStatus;
    planned_day_slot?: number;
    planned_session_key?: string;
}

export interface TrainingBlockTemplateSnapshot {
    template: TrainingBlockTemplateRow;
    days: TrainingBlockTemplateDayRow[];
    sessions: TrainingBlockTemplateSessionRow[];
}

const matchingContextCache = new Map<string, Promise<TrainingBlockMatchingContext>>();

function getTemplateIdsFromPlan(plan: TrainingBlockPlan): string[] {
    return [...new Set(plan.days.flatMap((day) =>
        day.sessions.map((session) => session.workout_template_id).filter((id): id is string => Boolean(id)),
    ))];
}

function createMatchingContextCacheKey(plan: TrainingBlockPlan): string {
    const templateIds = getTemplateIdsFromPlan(plan).slice().sort();
    return templateIds.length > 0
        ? templateIds.join("|")
        : `template:${plan.template_id ?? "default"}:${plan.start_date}:${plan.end_date}`;
}

export async function getTrainingBlockMatchingContext(
    plan: TrainingBlockPlan,
): Promise<TrainingBlockMatchingContext> {
    const cacheKey = createMatchingContextCacheKey(plan);
    const existing = matchingContextCache.get(cacheKey);
    if (existing) return existing;

    const request = (async () => ({
        linkedWorkoutTemplatesById: await getTrainingBlockLinkedWorkoutTemplates(getTemplateIdsFromPlan(plan)),
    } as TrainingBlockMatchingContext))();

    matchingContextCache.set(cacheKey, request);

    try {
        return await request;
    } catch (error) {
        matchingContextCache.delete(cacheKey);
        throw error;
    }
}



function addDaysIso(startDate: string, offsetDays: number): string {
    const [year, month, day] = startDate.split('-').map(Number);
    const date = new Date(year, (month ?? 1) - 1, day ?? 1);
    date.setDate(date.getDate() + offsetDays);
    const yyyy = date.getFullYear().toString().padStart(4, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function jsonObjectOrUndefined<T>(value: Database['public']['Tables']['training_block_templates']['Row']['metadata'] | null): T | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as T
        : undefined;
}

function jsonArrayOrUndefined<T>(value: Database['public']['Tables']['training_block_templates']['Row']['metadata'] | null): T[] | undefined {
    return Array.isArray(value) ? value as T[] : undefined;
}

function numberOrUndefined(value: number | string | null): number | undefined {
    if (value === null || value === undefined) return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTrainingBlockSessionTitle(
    session: TrainingBlockTemplateSessionRow,
    expectedDistanceMeters: number | undefined,
): string {
    if (session.family.startsWith('flush_') && expectedDistanceMeters !== undefined) {
        return `Flush ${formatKilometerLabel(expectedDistanceMeters)}`;
    }

    return session.title;
}

export function templateRowsToTrainingBlockPlan(
    snapshot: TrainingBlockTemplateSnapshot,
    startDate?: string | null,
): TrainingBlockPlan {
    const resolvedStartDate = startDate ?? snapshot.template.default_start_date ?? addDaysIso(new Date().toISOString().slice(0, 10), 0);
    const sessionsByDay = new Map<string, TrainingBlockTemplateSessionRow[]>();

    snapshot.sessions.forEach((session) => {
        const sessions = sessionsByDay.get(session.template_day_id) ?? [];
        sessions.push(session);
        sessionsByDay.set(session.template_day_id, sessions);
    });

    const days: TrainingBlockPlannedDay[] = [...snapshot.days]
        .sort((a, b) => a.week_number - b.week_number || a.day_slot - b.day_slot)
        .map((day): TrainingBlockPlannedDay => {
            const offset = (day.week_number - 1) * 7 + day.day_slot;
            const daySessions = (sessionsByDay.get(day.id) ?? [])
                .sort((a, b) => a.sort_order - b.sort_order || a.session_key.localeCompare(b.session_key))
                .map((session): TrainingBlockPlannedSession => {
                    const expectedDistanceMeters = numberOrUndefined(session.expected_distance_meters);

                    return {
                        id: session.session_key,
                        title: normalizeTrainingBlockSessionTitle(session, expectedDistanceMeters),
                        planned_rwn: session.planned_rwn ?? undefined,
                        workout_template_id: session.workout_template_id,
                        support_prescription: jsonObjectOrUndefined<TrainingBlockSupportPrescription>(session.support_prescription),
                        family: session.family as TrainingBlockWorkoutFamily,
                        role: session.role as TrainingBlockSessionRole,
                        source: session.source as TrainingBlockSessionSource,
                        expected_distance_meters: expectedDistanceMeters,
                        expected_duration_minutes: numberOrUndefined(session.expected_duration_minutes),
                        target_split_seconds_per_500m: numberOrUndefined(session.target_split_seconds_per_500m),
                        intervals: jsonArrayOrUndefined<TrainingBlockIntervalSpec>(session.intervals),
                        instructions: session.instructions ?? undefined,
                        counts_toward_weekly_volume: session.counts_toward_weekly_volume,
                        is_key_session: session.is_key_session,
                    };
                });

            return {
                date: addDaysIso(resolvedStartDate, offset),
                week_number: day.week_number,
                day_of_week: day.day_of_week,
                weekday_index: day.day_slot,
                day_slot: day.day_slot,
                category: day.category as TrainingBlockDayCategory,
                sessions: daySessions,
                planned_distance_meters: day.planned_distance_meters,
                target_distance_meters: day.target_distance_meters,
                reference: jsonObjectOrUndefined<TrainingBlockReferenceContent>(day.reference),
            };
        });

    const endDate = addDaysIso(resolvedStartDate, snapshot.template.duration_weeks * 7 - 1);

    return {
        template_id: snapshot.template.template_key as TrainingBlockTemplateKey,
        start_date: resolvedStartDate,
        end_date: endDate,
        duration_weeks: snapshot.template.duration_weeks,
        days,
    };
}

export function buildTrainingBlockEnrollmentInsert(input: EnsureTrainingBlockEnrollmentInput): TrainingBlockEnrollmentInsert {
    return {
        user_id: input.userId,
        template_id: input.templateId ?? null,
        template_key: input.templateKey,
        start_date: input.startDate,
        end_date: input.endDate,
        is_active: input.isActive,
        status: input.isActive ? 'active' : 'paused',
        metadata: {
            source: 'training_block_enrollment',
        },
    };
}

export function buildTrainingBlockLogReviewUpsert(input: BuildTrainingBlockLogReviewInput): TrainingBlockLogReviewInsert {
    return {
        enrollment_id: input.enrollmentId,
        user_id: input.userId,
        workout_log_id: input.workoutLogId,
        planned_week_number: input.plannedWeekNumber ?? null,
        planned_day_slot: input.plannedDaySlot ?? null,
        planned_session_key: input.plannedSessionKey ?? null,
        status: input.status ?? null,
        key_session_credit: input.keySessionCredit ?? null,
        strength_status: input.strengthStatus ?? null,
        notes: input.notes ?? null,
        metadata: {
            source: 'training_block_review',
        },
    };
}

export function reviewRowToOverride(row: TrainingBlockLogReviewRow): TrainingBlockReviewOverride {
    const override: TrainingBlockReviewOverride = {};
    if (row.status) override.status = row.status as TrainingBlockWorkoutStatus;
    if (row.key_session_credit) override.key_session_credit = row.key_session_credit as TrainingBlockKeySessionCredit;
    if (row.strength_status) override.strength_status = row.strength_status as TrainingBlockStrengthStatus;
    if (row.planned_day_slot === 0 || row.planned_day_slot) override.planned_day_slot = row.planned_day_slot;
    if (row.planned_session_key) override.planned_session_key = row.planned_session_key;
    return override;
}

export async function getTrainingBlockPlanFromDatabase(
    templateKey: TrainingBlockTemplateKey,
    startDate?: string | null,
): Promise<TrainingBlockPlan | null> {
    const { data: template, error: templateError } = await supabase
        .from('training_block_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('status', 'published')
        .maybeSingle();

    if (templateError) throw templateError;
    if (!template) return null;

    const { data: days, error: daysError } = await supabase
        .from('training_block_template_days')
        .select('*')
        .eq('template_id', template.id)
        .order('week_number', { ascending: true })
        .order('day_slot', { ascending: true });

    if (daysError) throw daysError;
    if (!days || days.length === 0) return null;

    const { data: sessions, error: sessionsError } = await supabase
        .from('training_block_template_sessions')
        .select('*')
        .in('template_day_id', days.map((day) => day.id))
        .order('sort_order', { ascending: true });

    if (sessionsError) throw sessionsError;

    return templateRowsToTrainingBlockPlan({
        template,
        days,
        sessions: sessions ?? [],
    }, startDate);
}

export async function getTrainingBlockTemplateId(templateKey: TrainingBlockTemplateKey): Promise<string | null> {
    const { data, error } = await supabase
        .from('training_block_templates')
        .select('id')
        .eq('template_key', templateKey)
        .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
}

export async function getTrainingBlockLinkedWorkoutTemplates(
    templateIds: readonly string[],
): Promise<Map<string, TrainingBlockLinkedWorkoutTemplate>> {
    const uniqueIds = [...new Set(templateIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();

    const { data, error } = await supabase
        .from('workout_templates')
        .select('id, name, canonical_name, workout_type, status, rwn')
        .in('id', uniqueIds);

    if (error) throw error;

    return new Map((data ?? []).map((template) => [
        template.id,
        {
            id: template.id,
            name: template.name,
            canonical_name: template.canonical_name,
            workout_type: template.workout_type,
            status: template.status,
            rwn: template.rwn,
        },
    ]));
}

export async function getTrainingBlockEnrollment(
    userId: string,
    templateKey: TrainingBlockTemplateKey,
): Promise<TrainingBlockEnrollmentRow | null> {
    const { data, error } = await supabase
        .from('training_block_enrollments')
        .select('*')
        .eq('user_id', userId)
        .eq('template_key', templateKey)
        .is('team_id', null)
        .is('org_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data ?? null;
}

export async function ensureTrainingBlockEnrollment(
    input: EnsureTrainingBlockEnrollmentInput,
): Promise<TrainingBlockEnrollmentRow> {
    const existing = await getTrainingBlockEnrollment(input.userId, input.templateKey);
    const templateId = input.templateId ?? await getTrainingBlockTemplateId(input.templateKey);

    if (input.isActive) {
        await supabase
            .from('training_block_enrollments')
            .update({ is_active: false, status: 'paused' })
            .eq('user_id', input.userId)
            .is('team_id', null)
            .is('org_id', null)
            .neq('template_key', input.templateKey);
    }

    if (existing) {
        const { data, error } = await supabase
            .from('training_block_enrollments')
            .update({
                template_id: templateId,
                start_date: input.startDate,
                end_date: input.endDate,
                is_active: input.isActive,
                status: input.isActive ? 'active' : 'paused',
            })
            .eq('id', existing.id)
            .select('*')
            .single();

        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from('training_block_enrollments')
        .insert(buildTrainingBlockEnrollmentInsert({ ...input, templateId }))
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function getTrainingBlockLogReviews(enrollmentId: string): Promise<TrainingBlockLogReviewRow[]> {
    const { data, error } = await supabase
        .from('training_block_log_reviews')
        .select('*')
        .eq('enrollment_id', enrollmentId);

    if (error) throw error;
    return data ?? [];
}

export async function upsertTrainingBlockLogReview(input: BuildTrainingBlockLogReviewInput): Promise<TrainingBlockLogReviewRow> {
    const { data, error } = await supabase
        .from('training_block_log_reviews')
        .upsert(buildTrainingBlockLogReviewUpsert(input), { onConflict: 'enrollment_id,workout_log_id' })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function deleteTrainingBlockLogReview(enrollmentId: string, workoutLogId: string): Promise<void> {
    const { error } = await supabase
        .from('training_block_log_reviews')
        .delete()
        .eq('enrollment_id', enrollmentId)
        .eq('workout_log_id', workoutLogId);

    if (error) throw error;
}
