import { parseRWN, structureToRWN } from '@readyall/rwn';

import type { TrainingBlockActualLogEvent, TrainingBlockPlannedDay, TrainingBlockPlannedSession } from '../types/trainingBlock.types';
import type { WorkoutStructure } from '../types/workoutStructure.types';
import { normalizeForMatching } from './workoutNormalization';
import { canonicalSignatureFromCanonicalName, deriveCanonicalNameFromRWN, deriveCanonicalNameFromStructure } from './workoutCanonical';

export type TrainingBlockAssignmentRelationship =
    | 'satisfies'
    | 'modifies'
    | 'conflicts'
    | 'support_only'
    | 'unmatched';

export interface TrainingBlockMatchCandidate {
    id: string;
    scheduled_date?: string | null;
    title?: string | null;
    canonical_name?: string | null;
    manual_rwn?: string | null;
    template_id?: string | null;
    workout_structure?: WorkoutStructure | null;
    workout_type?: string | null;
    training_zone?: string | null;
    distance_meters?: number | null;
    duration_seconds?: number | null;
    source?: string | null;
    notes?: string | null;
}

export type TrainingBlockAssignmentCandidate = TrainingBlockMatchCandidate;

export interface TrainingBlockAssignmentMatch {
    relationship: TrainingBlockAssignmentRelationship;
    confidence: number;
    planned_session_id?: string;
    planned_session_title?: string;
    reason: string;
}

export interface TrainingBlockWeekMatch {
    planned_day: TrainingBlockPlannedDay;
    planned_day_key: string;
    match: TrainingBlockAssignmentMatch;
}

type ParsedRWNInfo = {
    canonical: string;
    core: string;
    modality: WorkoutStructure['modality'];
    origin: 'explicit' | 'metric';
    librarySignature: string | null;
};

function normalizeSignature(value: string | null | undefined): string | null {
    if (!value?.trim()) return null;
    const normalized = normalizeForMatching(value.trim());
    return normalized || null;
}

function parseRWNInfo(value: string | null | undefined, origin: ParsedRWNInfo['origin'] = 'explicit'): ParsedRWNInfo | null {
    if (!value?.trim()) return null;
    const parsed = parseRWN(value);
    if (!parsed) return null;

    const canonical = structureToRWN(parsed);
    const normalized = normalizeSignature(canonical);
    if (!normalized) return null;

    const modality = parsed.modality;
    const core = normalizeSignature(canonical.replace(/^(row|bike|ski|run|cross|other):\s*/i, '')) ?? normalized;
    const librarySignature = canonicalSignatureFromCanonicalName(deriveCanonicalNameFromRWN(canonical));
    return { canonical: normalized, core, modality, origin, librarySignature };
}

function canonicalNameInfo(value: string | null | undefined): ParsedRWNInfo | null {
    const parsed = parseRWNInfo(value);
    const librarySignature = canonicalSignatureFromCanonicalName(value);
    if (!parsed) {
        if (!librarySignature) return null;
        return {
            canonical: librarySignature,
            core: librarySignature,
            modality: undefined,
            origin: 'explicit',
            librarySignature,
        };
    }

    return {
        ...parsed,
        librarySignature: parsed.librarySignature ?? librarySignature,
    };
}

function structureRWNInfo(structure: WorkoutStructure | null | undefined): ParsedRWNInfo | null {
    if (!structure) return null;
    const parsed = parseRWNInfo(structureToRWN(structure));
    const librarySignature = canonicalSignatureFromCanonicalName(deriveCanonicalNameFromStructure(structure));
    if (!parsed) return null;
    return {
        ...parsed,
        librarySignature: parsed.librarySignature ?? librarySignature,
    };
}

function formatDurationRWN(seconds: number): string {
    const rounded = Math.round(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function metricFallbackRWN(candidate: TrainingBlockMatchCandidate): string | null {
    if (candidate.distance_meters && candidate.distance_meters > 0) {
        return `${Math.round(candidate.distance_meters)}m`;
    }
    if (candidate.duration_seconds && candidate.duration_seconds > 0) {
        return formatDurationRWN(candidate.duration_seconds);
    }
    return null;
}

function assignmentRWNInfos(assignment: TrainingBlockMatchCandidate): ParsedRWNInfo[] {
    const candidates = [
        parseRWNInfo(assignment.manual_rwn),
        canonicalNameInfo(assignment.canonical_name),
        structureRWNInfo(assignment.workout_structure),
        parseRWNInfo(metricFallbackRWN(assignment), 'metric'),
    ];

    const seen = new Set<string>();
    return candidates.filter((candidate): candidate is ParsedRWNInfo => {
        if (!candidate || seen.has(candidate.canonical)) return false;
        seen.add(candidate.canonical);
        return true;
    });
}

function assignmentText(assignment: TrainingBlockMatchCandidate): string {
    return `${assignment.title ?? ''} ${assignment.workout_type ?? ''} ${assignment.canonical_name ?? ''} ${assignment.manual_rwn ?? ''} ${assignment.notes ?? ''}`.toLowerCase();
}

function isSupportAssignmentForSession(assignment: TrainingBlockMatchCandidate, session: TrainingBlockPlannedSession): boolean {
    if (!session.support_prescription) return false;

    const text = assignmentText(assignment);
    const kind = session.support_prescription.kind;
    if (text.includes(kind)) return true;
    if (session.family.includes('strength') && /strength|lift|squat|deadlift|press|pull|push/.test(text)) return true;
    if (session.family.includes('strength_pull') && /pull|deadlift|row|lat/.test(text)) return true;
    if (session.family.includes('strength_push') && /push|squat|press|lunge|ab wheel/.test(text)) return true;
    return false;
}


function scoreTemplateLinkSession(
    session: TrainingBlockPlannedSession,
    assignment: TrainingBlockMatchCandidate,
): TrainingBlockAssignmentMatch | null {
    if (!session.workout_template_id || !assignment.template_id) return null;
    if (session.workout_template_id !== assignment.template_id) return null;

    return {
        relationship: 'satisfies',
        confidence: 0.99,
        planned_session_id: session.id,
        planned_session_title: session.title,
        reason: 'Workout log is linked to the same workout-library template as the planned session.',
    };
}

function scoreRWNSession(
    session: TrainingBlockPlannedSession,
    assignmentInfo: ParsedRWNInfo,
): TrainingBlockAssignmentMatch | null {
    const plannedInfo = parseRWNInfo(session.planned_rwn);
    if (!plannedInfo) return null;

    if (assignmentInfo.canonical === plannedInfo.canonical) {
        const metricOnly = assignmentInfo.origin === 'metric';
        return {
            relationship: 'satisfies',
            confidence: metricOnly ? 0.78 : 0.97,
            planned_session_id: session.id,
            planned_session_title: session.title,
            reason: metricOnly
                ? 'Workout distance or duration matches the planned session.'
                : 'Workout RWN exactly matches the planned session RWN.',
        };
    }

    if (assignmentInfo.origin !== 'metric'
        && assignmentInfo.librarySignature
        && plannedInfo.librarySignature
        && assignmentInfo.librarySignature === plannedInfo.librarySignature) {
        return {
            relationship: 'satisfies',
            confidence: 0.93,
            planned_session_id: session.id,
            planned_session_title: session.title,
            reason: 'Workout canonical signature matches the planned session type used for library history and trends.',
        };
    }

    const genericCross = session.source === 'cross_training' && plannedInfo.modality === 'cross';
    const specificCrossModality = assignmentInfo.modality === 'bike'
        || assignmentInfo.modality === 'ski'
        || assignmentInfo.modality === 'run'
        || assignmentInfo.modality === 'cross';
    if (genericCross && specificCrossModality && assignmentInfo.core === plannedInfo.core) {
        return {
            relationship: 'satisfies',
            confidence: 0.9,
            planned_session_id: session.id,
            planned_session_title: session.title,
            reason: 'Specific cross-training modality satisfies the generic Cross prescription.',
        };
    }

    const sameGeneralSource = session.source === 'erg'
        ? !assignmentInfo.modality || assignmentInfo.modality === 'row'
        : session.source === 'cross_training' && specificCrossModality;

    if (sameGeneralSource) {
        return {
            relationship: 'modifies',
            confidence: 0.62,
            planned_session_id: session.id,
            planned_session_title: session.title,
            reason: 'Workout is the same broad training mode but does not match the planned RWN exactly.',
        };
    }

    return null;
}

export function rankTrainingBlockMatch(match: TrainingBlockAssignmentMatch): number {
    const relationshipRank: Record<TrainingBlockAssignmentRelationship, number> = {
        satisfies: 5,
        modifies: 4,
        support_only: 3,
        conflicts: 2,
        unmatched: 1,
    };
    return relationshipRank[match.relationship] * 100 + match.confidence;
}

export function scoreCandidateAgainstPlanDay(
    day: TrainingBlockPlannedDay,
    assignment: TrainingBlockMatchCandidate,
): TrainingBlockAssignmentMatch {
    const assignmentInfos = assignmentRWNInfos(assignment);
    const matches: TrainingBlockAssignmentMatch[] = [];

    for (const session of day.sessions) {
        const templateLinkMatch = scoreTemplateLinkSession(session, assignment);
        if (templateLinkMatch) matches.push(templateLinkMatch);

        for (const assignmentInfo of assignmentInfos) {
            const match = scoreRWNSession(session, assignmentInfo);
            if (match) matches.push(match);
        }

        if (isSupportAssignmentForSession(assignment, session)) {
            matches.push({
                relationship: 'support_only',
                confidence: 0.68,
                planned_session_id: session.id,
                planned_session_title: session.title,
                reason: 'Workout appears to cover planned support work, but support work is not canonical RWN yet.',
            });
        }
    }

    matches.sort((a, b) => rankTrainingBlockMatch(b) - rankTrainingBlockMatch(a));
    if (matches[0]) return matches[0];

    if (day.category === 'rest') {
        return {
            relationship: 'conflicts',
            confidence: 0.4,
            reason: 'Workout is scheduled on a planned rest day.',
        };
    }

    return {
        relationship: 'unmatched',
        confidence: 0.2,
        reason: assignmentInfos.length > 0
            ? 'Workout RWN does not correspond to any planned session on this day.'
            : 'Workout has no comparable RWN or recognized support-work signal.',
    };
}


export function scoreCandidateAgainstPlanWeek(
    days: readonly TrainingBlockPlannedDay[],
    candidate: TrainingBlockMatchCandidate,
): TrainingBlockWeekMatch | null {
    const matches = days
        .filter((day) => day.category !== 'rest')
        .map((day) => ({
            planned_day: day,
            planned_day_key: `${day.week_number}:${day.day_slot}`,
            match: scoreCandidateAgainstPlanDay(day, candidate),
        }))
        .filter(({ match }) => match.relationship !== 'unmatched' && match.relationship !== 'conflicts')
        .sort((a, b) => {
            const rankDelta = rankTrainingBlockMatch(b.match) - rankTrainingBlockMatch(a.match);
            if (rankDelta !== 0) return rankDelta;
            return a.planned_day.day_slot - b.planned_day.day_slot;
        });

    return matches[0] ?? null;
}

export function scoreAssignmentAgainstPlanWeek(
    days: readonly TrainingBlockPlannedDay[],
    assignment: TrainingBlockAssignmentCandidate,
): TrainingBlockWeekMatch | null {
    return scoreCandidateAgainstPlanWeek(days, assignment);
}

export function scoreAssignmentAgainstPlanDay(
    day: TrainingBlockPlannedDay,
    assignment: TrainingBlockAssignmentCandidate,
): TrainingBlockAssignmentMatch {
    return scoreCandidateAgainstPlanDay(day, assignment);
}


export function scoreLogAgainstPlanWeek(
    days: readonly TrainingBlockPlannedDay[],
    log: TrainingBlockActualLogEvent,
): TrainingBlockWeekMatch | null {
    return scoreCandidateAgainstPlanWeek(days, {
        id: log.workout_id,
        scheduled_date: log.date,
        title: log.workout_name,
        canonical_name: log.canonical_name,
        manual_rwn: log.manual_rwn,
        template_id: log.template_id,
        workout_type: log.workout_type,
        distance_meters: log.distance_meters,
        duration_seconds: log.duration_seconds,
        source: log.source,
        notes: log.notes,
    });
}

export function scoreLogAgainstPlanDay(
    day: TrainingBlockPlannedDay,
    log: TrainingBlockActualLogEvent,
): TrainingBlockAssignmentMatch {
    return scoreCandidateAgainstPlanDay(day, {
        id: log.workout_id,
        scheduled_date: log.date,
        title: log.workout_name,
        canonical_name: log.canonical_name,
        manual_rwn: log.manual_rwn,
        template_id: log.template_id,
        workout_type: log.workout_type,
        distance_meters: log.distance_meters,
        duration_seconds: log.duration_seconds,
        source: log.source,
        notes: log.notes,
    });
}
