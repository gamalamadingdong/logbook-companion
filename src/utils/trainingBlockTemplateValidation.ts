import { parseRWN } from './rwnParser';
import type {
    TrainingBlockDayCategory,
    TrainingBlockPlan,
    TrainingBlockPlannedDay,
    TrainingBlockPlannedSession,
    TrainingBlockSessionSource,
} from '../types/trainingBlock.types';

export type TrainingBlockTemplateIssueSeverity = 'warning' | 'error';

export interface TrainingBlockTemplateIssue {
    severity: TrainingBlockTemplateIssueSeverity;
    code: string;
    message: string;
    week_number?: number;
    day_slot?: number;
    session_id?: string;
}

export interface TrainingBlockLinkedWorkoutTemplate {
    id: string;
    name: string;
    rwn: string | null;
    canonical_name?: string | null;
    workout_type?: string | null;
    status?: string | null;
}

export interface TrainingBlockTemplateHealth {
    source: 'database' | 'static';
    total_days: number;
    expected_days: number;
    total_sessions: number;
    library_linked_sessions: number;
    linked_sessions_with_library_rwn: number;
    linked_sessions_with_block_rwn: number;
    linked_sessions_using_library_rwn: number;
    linked_sessions_with_rwn_mismatch: number;
    missing_linked_template_count: number;
    block_local_sessions: number;
    rwn_session_count: number;
    support_session_count: number;
    rest_day_count: number;
    empty_day_count: number;
    warning_count: number;
    error_count: number;
    issues: TrainingBlockTemplateIssue[];
}

export interface ValidateTrainingBlockTemplateOptions {
    source?: TrainingBlockTemplateHealth['source'];
    linkedWorkoutTemplatesById?: ReadonlyMap<string, TrainingBlockLinkedWorkoutTemplate>;
}

const SUPPORT_SOURCES = new Set<TrainingBlockSessionSource>(['strength']);
const RWN_EXPECTED_SOURCES = new Set<TrainingBlockSessionSource>(['erg', 'cross_training']);
const VALID_DAY_CATEGORIES = new Set<TrainingBlockDayCategory>(['erg', 'cross_training', 'rest']);
const VALID_SESSION_SOURCES = new Set<TrainingBlockSessionSource>(['erg', 'cross_training', 'strength', 'rest']);

function sessionLabel(session: TrainingBlockPlannedSession): string {
    return session.title || session.id;
}

function addIssue(
    issues: TrainingBlockTemplateIssue[],
    severity: TrainingBlockTemplateIssueSeverity,
    code: string,
    message: string,
    day?: TrainingBlockPlannedDay,
    session?: TrainingBlockPlannedSession,
): void {
    issues.push({
        severity,
        code,
        message,
        week_number: day?.week_number,
        day_slot: day?.day_slot,
        session_id: session?.id,
    });
}

function normalizeRWN(value: string | null | undefined): string | null {
    const parsed = value?.trim() ? parseRWN(value) : null;
    if (!parsed) return null;
    return value!.replace(/\s+/g, '').toLowerCase();
}

function validateSession(
    issues: TrainingBlockTemplateIssue[],
    day: TrainingBlockPlannedDay,
    session: TrainingBlockPlannedSession,
    linkedTemplate: TrainingBlockLinkedWorkoutTemplate | null,
): void {
    if (!VALID_SESSION_SOURCES.has(session.source)) {
        addIssue(
            issues,
            'error',
            'invalid_session_source',
            `Session "${sessionLabel(session)}" has unsupported source "${session.source}".`,
            day,
            session,
        );
    }

    if (session.workout_template_id) {
        if (SUPPORT_SOURCES.has(session.source)) {
            addIssue(
                issues,
                'warning',
                'support_session_linked_to_workout_template',
                `Support session "${sessionLabel(session)}" links to a workout-library template before support work has a canonical library/RWN model.`,
                day,
                session,
            );
        }

        if (!linkedTemplate) {
            addIssue(
                issues,
                'error',
                'missing_linked_workout_template',
                `Session "${sessionLabel(session)}" links to a workout template that was not found.`,
                day,
                session,
            );
        } else if (!linkedTemplate.rwn?.trim()) {
            addIssue(
                issues,
                'warning',
                'linked_template_missing_rwn',
                `Linked workout template "${linkedTemplate.name}" has no RWN.`,
                day,
                session,
            );
        } else if (!parseRWN(linkedTemplate.rwn)) {
            addIssue(
                issues,
                'error',
                'linked_template_invalid_rwn',
                `Linked workout template "${linkedTemplate.name}" has invalid RWN: ${linkedTemplate.rwn}.`,
                day,
                session,
            );
        }

        const sessionRWN = normalizeRWN(session.planned_rwn);
        const libraryRWN = normalizeRWN(linkedTemplate?.rwn);
        if (sessionRWN && libraryRWN && sessionRWN !== libraryRWN) {
            addIssue(
                issues,
                'warning',
                'linked_rwn_mismatch',
                `Session "${sessionLabel(session)}" has block RWN that differs from linked workout template RWN.`,
                day,
                session,
            );
        }
    }

    if (RWN_EXPECTED_SOURCES.has(session.source)) {
        const blockRWN = session.planned_rwn?.trim() || null;
        const hasLibraryRWN = Boolean(linkedTemplate?.rwn?.trim() && parseRWN(linkedTemplate.rwn));

        if (!blockRWN && !hasLibraryRWN) {
            addIssue(
                issues,
                'warning',
                'missing_rwn',
                `Session "${sessionLabel(session)}" is ${session.source} work without block or linked library RWN.`,
                day,
                session,
            );
        } else if (blockRWN && !parseRWN(blockRWN)) {
            addIssue(
                issues,
                'error',
                'invalid_rwn',
                `Session "${sessionLabel(session)}" has invalid RWN: ${session.planned_rwn}.`,
                day,
                session,
            );
        }
    }

    if (SUPPORT_SOURCES.has(session.source) && !session.support_prescription) {
        addIssue(
            issues,
            'warning',
            'missing_support_prescription',
            `Support session "${sessionLabel(session)}" has no structured support prescription.`,
            day,
            session,
        );
    }

    if (session.source === 'rest' && (session.planned_rwn || session.workout_template_id || session.support_prescription)) {
        addIssue(
            issues,
            'warning',
            'rest_session_has_work',
            `Rest session "${sessionLabel(session)}" includes workout prescription data.`,
            day,
            session,
        );
    }

    if (session.source === 'erg' && day.category === 'cross_training') {
        addIssue(
            issues,
            'warning',
            'session_day_category_mismatch',
            `Erg session "${sessionLabel(session)}" is scheduled on a cross-training day.`,
            day,
            session,
        );
    }

    if (session.source === 'cross_training' && day.category === 'erg') {
        addIssue(
            issues,
            'warning',
            'session_day_category_mismatch',
            `Cross-training session "${sessionLabel(session)}" is scheduled on an erg day.`,
            day,
            session,
        );
    }
}

export function validateTrainingBlockTemplate(
    plan: TrainingBlockPlan,
    options: ValidateTrainingBlockTemplateOptions = {},
): TrainingBlockTemplateHealth {
    const issues: TrainingBlockTemplateIssue[] = [];
    let totalSessions = 0;
    let libraryLinkedSessions = 0;
    let linkedSessionsWithLibraryRWN = 0;
    let linkedSessionsWithBlockRWN = 0;
    let linkedSessionsUsingLibraryRWN = 0;
    let linkedSessionsWithRwnMismatch = 0;
    let missingLinkedTemplateCount = 0;
    let rwnSessionCount = 0;
    let supportSessionCount = 0;
    let emptyDayCount = 0;

    const expectedDays = plan.duration_weeks * 7;
    if (plan.days.length !== expectedDays) {
        addIssue(
            issues,
            'warning',
            'unexpected_day_count',
            `Template has ${plan.days.length} days; expected ${expectedDays} for ${plan.duration_weeks} weeks.`,
        );
    }

    plan.days.forEach((day) => {
        const seenSessionIdsForDay = new Set<string>();

        if (!VALID_DAY_CATEGORIES.has(day.category)) {
            addIssue(
                issues,
                'error',
                'invalid_day_category',
                `Day has unsupported category "${day.category}".`,
                day,
            );
        }

        if (day.sessions.length === 0) {
            emptyDayCount += 1;
            addIssue(
                issues,
                day.category === 'rest' ? 'warning' : 'error',
                'empty_day',
                `Day ${day.week_number}.${day.day_slot + 1} has no scheduled sessions.`,
                day,
            );
        }

        day.sessions.forEach((session) => {
            totalSessions += 1;
            const linkedTemplate = session.workout_template_id
                ? options.linkedWorkoutTemplatesById?.get(session.workout_template_id) ?? null
                : null;

            if (session.workout_template_id) {
                libraryLinkedSessions += 1;
                if (!linkedTemplate) missingLinkedTemplateCount += 1;
                if (session.planned_rwn?.trim()) linkedSessionsWithBlockRWN += 1;
                if (linkedTemplate?.rwn?.trim()) linkedSessionsWithLibraryRWN += 1;

                const sessionRWN = normalizeRWN(session.planned_rwn);
                const libraryRWN = normalizeRWN(linkedTemplate?.rwn);
                if (!sessionRWN && libraryRWN) linkedSessionsUsingLibraryRWN += 1;
                if (sessionRWN && libraryRWN && sessionRWN !== libraryRWN) linkedSessionsWithRwnMismatch += 1;
            }
            if (session.planned_rwn?.trim()) rwnSessionCount += 1;
            if (session.support_prescription) supportSessionCount += 1;

            if (seenSessionIdsForDay.has(session.id)) {
                addIssue(
                    issues,
                    'error',
                    'duplicate_session_id',
                    `Session id "${session.id}" appears more than once on this planned day.`,
                    day,
                    session,
                );
            }
            seenSessionIdsForDay.add(session.id);

            validateSession(issues, day, session, linkedTemplate);
        });
    });

    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
    const errorCount = issues.filter((issue) => issue.severity === 'error').length;

    return {
        source: options.source ?? 'static',
        total_days: plan.days.length,
        expected_days: expectedDays,
        total_sessions: totalSessions,
        library_linked_sessions: libraryLinkedSessions,
        linked_sessions_with_library_rwn: linkedSessionsWithLibraryRWN,
        linked_sessions_with_block_rwn: linkedSessionsWithBlockRWN,
        linked_sessions_using_library_rwn: linkedSessionsUsingLibraryRWN,
        linked_sessions_with_rwn_mismatch: linkedSessionsWithRwnMismatch,
        missing_linked_template_count: missingLinkedTemplateCount,
        block_local_sessions: totalSessions - libraryLinkedSessions,
        rwn_session_count: rwnSessionCount,
        support_session_count: supportSessionCount,
        rest_day_count: plan.days.filter((day) => day.category === 'rest').length,
        empty_day_count: emptyDayCount,
        warning_count: warningCount,
        error_count: errorCount,
        issues,
    };
}
