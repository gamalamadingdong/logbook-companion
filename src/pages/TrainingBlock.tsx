import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CalendarDays, CheckCircle2, Eye, Flame, ListChecks, Plus, Power, Settings, Target, Trash2, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardHeader } from '../components/ui';
import { Badge, Modal } from '../components/ui';
import { buildRowing12WeekPlan, ROWING_12_WEEK_TEMPLATE } from '../data/rowingTrainingBlockTemplate';
import {
    alignLogsToPlanDays,
    summarizeDayProgress,
    summarizeWeekProgress,
} from '../utils/trainingBlockCalculations';
import {
    scoreAssignmentAgainstPlanDay,
    scoreAssignmentAgainstPlanWeek,
    toTrainingBlockActualLogEvent,
    scoreLogAgainstPlanDay,
    type TrainingBlockAssignmentRelationship,
} from '../utils/trainingBlockMatching';
import {
    TRAINING_BLOCK_PLAN_OPTIONS,
    readSelectedTrainingBlockTemplate,
    readTrainingBlockActive,
    toTrainingBlockLocalDate,
    writeSelectedTrainingBlockTemplate,
    writeTrainingBlockActive,
    type TrainingBlockLifecycleStatus,
    type TrainingBlockPlanOptionId,
} from '../utils/trainingBlockStatus';
import {
    validateTrainingBlockTemplate,
    type TrainingBlockTemplateHealth,
} from '../utils/trainingBlockTemplateValidation';
import {
    getAthletes,
    getGroupAssignments,
    type GroupAssignment,
} from '../services/coaching/coachingService';
import type {
    TrainingBlockActualLogEvent,
    TrainingBlockDaySummary,
    TrainingBlockKeySessionCredit,
    TrainingBlockReferenceContent,
    TrainingBlockPlannedSession,
    TrainingBlockReferenceRoutine,
    TrainingBlockSessionSource,
    TrainingBlockSupportCompletionStatus,
    TrainingBlockWeekSummary,
    TrainingBlockStrengthStatus,
    TrainingBlockTemplateKey,
} from '../types/trainingBlock.types';
import type { Database } from '../types/database.types';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useScopedTeamScope } from '../hooks/useScopedTeamScope';
import { useTrainingBlockMatchingContext } from '../hooks/useTrainingBlockMatchingContext';
import { formatSplit, parsePaceToSeconds } from '../utils/paceCalculator';
import { formatDistanceMeters, formatSignedDistanceMeters } from '../utils/trainingBlockFormatting';
import { workoutService, type ManualWorkoutLogMode } from '../services/workoutService';
import {
    computeTrainingBlockEndDate,
    createTrainingBlockEnrollment,
    deleteTrainingBlockEnrollment,
    deleteTrainingBlockLogReview,
    deleteTrainingBlockSupportCompletion,
    ensureTrainingBlockEnrollment,
    getPublishedTrainingBlockTemplates,
    getTrainingBlockEnrollments,
    getTrainingBlockLogReviews,
    getTrainingBlockPlanFromDatabase,
    getTrainingBlockSupportCompletions,
    reviewRowToOverride,
    upsertTrainingBlockLogReview,
    upsertTrainingBlockSupportCompletion,
    type PublishedTrainingBlockTemplateOption,
    type TrainingBlockEnrollmentRow,
    type TrainingBlockSupportCompletionRow,
} from '../services/trainingBlockService';
import type { TrainingBlockWorkoutStatus } from '../types/trainingBlock.types';

type WorkoutLogRow = Database['public']['Tables']['workout_logs']['Row'];
type TrainingBlockWorkoutLogRow = Pick<
    WorkoutLogRow,
    | 'id'
    | 'completed_at'
    | 'distance_meters'
    | 'rest_distance_meters'
    | 'duration_seconds'
    | 'duration_minutes'
    | 'avg_split_500m'
    | 'perceived_exertion'
    | 'source'
    | 'workout_name'
    | 'manual_rwn'
    | 'canonical_name'
    | 'template_id'
    | 'notes'
    | 'workout_type'
    | 'user_id'
>;
type WorkoutLogOverride = Partial<Pick<
    TrainingBlockActualLogEvent,
    'status' | 'key_session_credit' | 'strength_status' | 'planned_day_slot' | 'planned_session_key'
>>;
type TeamAthleteOption = {
    userId: string;
    name: string;
    teamName: string;
};

type TeamAssignment = GroupAssignment & {
    teamName: string;
    assignmentScope: 'team' | 'org';
};

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

type AssignmentRelationshipTone = {
    label: string;
    variant: BadgeVariant;
    dot: boolean;
};

const assignmentRelationshipTone: Record<TrainingBlockAssignmentRelationship, AssignmentRelationshipTone> = {
    satisfies: { label: 'Satisfies plan', variant: 'success', dot: true },
    modifies: { label: 'Modified', variant: 'warning', dot: true },
    conflicts: { label: 'Conflicts', variant: 'danger', dot: true },
    support_only: { label: 'Support work', variant: 'coaching', dot: true },
    unmatched: { label: 'Extra effort', variant: 'muted', dot: false },
};

type WorkoutLogOverrides = Record<string, WorkoutLogOverride>;
type SupportCompletionMap = Record<string, TrainingBlockSupportCompletionRow>;
type SupportCompletionFormState = {
    status: TrainingBlockSupportCompletionStatus;
    minutesCompleted: string;
    perceivedExertion: string;
    painFlag: boolean;
    notes: string;
};
type SupportCompletionEditorState = {
    session: TrainingBlockPlannedSession;
    form: SupportCompletionFormState;
};
type SupportCompletionTarget = {
    plannedSessionKey: string;
    supportSessionTemplateId?: string | null;
    status: TrainingBlockSupportCompletionStatus;
    minutesCompleted?: number | null;
    perceivedExertion?: number | null;
    painFlag?: boolean;
    notes?: string | null;
};
type ManualEntryFormState = {
    mode: ManualWorkoutLogMode;
    plannedSessionId: string;
    completedDate: string;
    completedTime: string;
    manualRWN: string;
    distanceMetersInput: string;
    durationMinutes: string;
    avgSplit: string;
    perceivedExertion: string;
    notes: string;
    rowingOptIn: boolean;
};

interface DayLogEvent extends TrainingBlockActualLogEvent {
    workout_name: string;
    workout_type: string;
    rawDateLabel: string;
    rawCompletedAt: string;
    user_id: string;
    athlete_name?: string;
}

const TRAINING_BLOCK_OVERRIDE_STORAGE_KEY = 'training_block_log_review_overrides_v1';

const reviewSurfaceClass = 'rounded-lg border border-border bg-surface-card p-3 text-sm shadow-sm';
const reviewControlSurfaceClass = 'mt-3 rounded-lg border border-border bg-surface-secondary p-3';
const matchedCompletionClass = 'mt-3 space-y-2 rounded-lg border border-emerald-500/50 border-l-4 border-l-emerald-400 bg-surface-secondary p-3 shadow-sm';
const fieldClass = 'mt-1 h-9 w-full rounded-md border border-border bg-surface-card px-2 text-xs text-content-primary outline-none focus:border-blue-400/70 disabled:cursor-not-allowed disabled:opacity-60';
const manualFieldClass = 'mt-1 w-full rounded-md border border-border bg-surface-card px-2 py-2 text-xs text-content-primary outline-none focus:border-blue-400/70';
const AUTO_OVERRIDE_VALUE = 'AUTO_OVERRIDE';
const DOES_NOT_COUNT_VALUE = 'DOES_NOT_COUNT';

const supportCompletionOptions: Array<{ value: TrainingBlockSupportCompletionStatus; label: string }> = [
    { value: 'completed', label: 'Done' },
    { value: 'modified', label: 'Modified' },
    { value: 'partial', label: 'Partial' },
    { value: 'skipped', label: 'Skipped' },
];

const supportCompletionTone: Record<TrainingBlockSupportCompletionStatus, { label: string; variant: BadgeVariant }> = {
    completed: { label: 'Done', variant: 'success' },
    modified: { label: 'Modified', variant: 'warning' },
    partial: { label: 'Partial', variant: 'warning' },
    skipped: { label: 'Skipped', variant: 'muted' },
};

const overrideStatusOptions: Array<{
    value: TrainingBlockWorkoutStatus;
    label: string;
}> = [
    { value: 'as_written', label: 'As written' },
    { value: 'modified', label: 'Modified' },
    { value: 'swapped', label: 'Swapped' },
    { value: 'partial', label: 'Partial' },
    { value: 'skipped', label: 'Skipped' },
];

const overrideKeySessionOptions: Array<{
    value: TrainingBlockKeySessionCredit;
    label: string;
}> = [
    { value: 'yes', label: 'Yes' },
    { value: 'partial', label: 'Partial' },
    { value: 'no', label: 'No' },
    { value: 'n_a', label: 'N/A' },
];

const overrideStrengthOptions: Array<{
    value: TrainingBlockStrengthStatus;
    label: string;
}> = [
    { value: 'completed', label: 'Completed' },
    { value: 'modified', label: 'Modified' },
    { value: 'partial', label: 'Partial' },
    { value: 'skipped', label: 'Skipped' },
    { value: 'not_started', label: 'Not started' },
    { value: 'not_scheduled', label: 'Not scheduled' },
];

const overridePlanSlotOptions: Array<{
    value: number;
    label: string;
}> = [
    { value: 0, label: 'Day 1' },
    { value: 1, label: 'Day 2' },
    { value: 2, label: 'Day 3' },
    { value: 3, label: 'Day 4' },
    { value: 4, label: 'Day 5' },
    { value: 5, label: 'Day 6' },
    { value: 6, label: 'Day 7' },
];

const manualModeOptions: Array<{ value: ManualWorkoutLogMode; label: string }> = [
    { value: 'cross_training', label: 'Cross / bike / ski / run' },
    { value: 'strength', label: 'Strength' },
    { value: 'support', label: 'Core / mobility / other support' },
    { value: 'row', label: 'Rowing manual entry' },
];

function emptySupportCompletionForm(
    status: TrainingBlockSupportCompletionStatus = 'completed',
    completion?: TrainingBlockSupportCompletionRow | null,
): SupportCompletionFormState {
    return {
        status: completion?.status ?? status,
        minutesCompleted: completion?.minutes_completed ? String(completion.minutes_completed) : '',
        perceivedExertion: completion?.perceived_exertion ? String(completion.perceived_exertion) : '',
        painFlag: completion?.pain_flag ?? false,
        notes: completion?.notes ?? '',
    };
}

function supportCompletionKey(weekNumber: number, daySlot: number, sessionKey: string): string {
    return `${weekNumber}:${daySlot}:${sessionKey}`;
}

function emptyManualEntryForm(date: string, mode: ManualWorkoutLogMode, rwn = '', plannedSessionId = ''): ManualEntryFormState {
    return {
        mode,
        plannedSessionId,
        completedDate: date,
        completedTime: '12:00',
        manualRWN: rwn,
        distanceMetersInput: '',
        durationMinutes: '',
        avgSplit: '',
        perceivedExertion: '',
        notes: '',
        rowingOptIn: false,
    };
}

function mergeWorkoutLogOverride(
    prev: WorkoutLogOverrides,
    workoutId: string,
    updates: WorkoutLogOverride,
): { merged: WorkoutLogOverrides; next: WorkoutLogOverride | null } {
    const current = prev[workoutId] || {};
    const next: WorkoutLogOverride = {
        ...current,
        ...updates,
    };

    Object.keys(next).forEach((key) => {
        const typedKey = key as keyof WorkoutLogOverride;
        if (next[typedKey] === undefined) {
            delete next[typedKey];
        }
    });

    const merged: WorkoutLogOverrides = {
        ...prev,
    };

    if (Object.keys(next).length === 0) {
        delete merged[workoutId];
        return { merged, next: null };
    }

    merged[workoutId] = next;
    return { merged, next };
}


const STATIC_TRAINING_BLOCK_PLAN = ROWING_12_WEEK_TEMPLATE;

const STATIC_TEMPLATE_OPTION: PublishedTrainingBlockTemplateOption = {
    id: 'static-rowing-12-week-2026-v1',
    template_key: ROWING_12_WEEK_TEMPLATE.template_id,
    name: '12-week Pete Block',
    description: 'Current integrated rowing block',
    version: 1,
    source: 'static_fallback',
    duration_weeks: ROWING_12_WEEK_TEMPLATE.duration_weeks,
    default_start_date: ROWING_12_WEEK_TEMPLATE.start_date,
};

function localDateString(dateInput: string | Date): string {
    return toTrainingBlockLocalDate(dateInput);
}

function shiftLocalDateString(dateInput: string, days: number): string {
    const date = new Date(`${dateInput}T12:00:00`);
    date.setDate(date.getDate() + days);
    return localDateString(date);
}

function formatDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return '-';
    const rounded = Math.round(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function parseOptionalPositiveNumber(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatInputDateTime(date: string, time: string): string {
    const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '12:00';
    return new Date(`${date}T${safeTime}:00`).toISOString();
}

function formatInputTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '12:00';
    return `${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}`;
}

function getMondaySnappedDate(dateInput: string | Date = new Date()): string {
    const date = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00`) : new Date(dateInput);
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + offset);
    return localDateString(date);
}

function formatDateLabel(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

const lifecycleStatusLabel: Record<TrainingBlockLifecycleStatus, string> = {
    preview: 'Preview',
    scheduled: 'Scheduled',
    active: 'Active',
    complete: 'Complete',
    paused: 'Paused',
};

const lifecycleStatusTone: Record<TrainingBlockLifecycleStatus, BadgeVariant> = {
    preview: 'info',
    scheduled: 'info',
    active: 'success',
    complete: 'coaching',
    paused: 'muted',
};

function getEnrollmentLifecycleStatus(
    enrollment: TrainingBlockEnrollmentRow,
    dateInput: string | Date = new Date(),
): TrainingBlockLifecycleStatus {
    if (!enrollment.is_active) {
        if (enrollment.status === 'scheduled') return 'scheduled';
        return enrollment.status === 'completed' ? 'complete' : 'paused';
    }

    const today = toTrainingBlockLocalDate(dateInput);
    if (today < enrollment.start_date) return 'preview';
    if (today > enrollment.end_date) return 'complete';
    return 'active';
}

function formatWeekday(date: string): string {
    const parts = localDateString(date);
    return new Date(`${parts}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

function resolveRoutineForSession(reference: TrainingBlockReferenceContent | undefined, sessionTitle: string, source: string): TrainingBlockReferenceRoutine | undefined {
    if (!reference?.routines?.length || source !== 'strength') {
        return undefined;
    }

    const normalizedTitle = sessionTitle.toLowerCase();
    const explicitRoutine = reference.routines.find((routine) => normalizedTitle.includes(routine.kind));
    if (explicitRoutine) {
        return explicitRoutine;
    }

    if (normalizedTitle.includes('push')) {
        return reference.routines.find((routine) => routine.kind === 'push');
    }
    if (normalizedTitle.includes('pull')) {
        return reference.routines.find((routine) => routine.kind === 'pull');
    }

    return reference.routines[0];
}

function formatReferenceList(items: readonly string[] | undefined, title: string): React.ReactElement | null {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="text-xs">
            <p className="text-neutral-400 uppercase text-[11px] tracking-wide mb-1">{title}</p>
            <ul className="space-y-1 list-disc list-inside text-neutral-300">
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    );
}

function formatExerciseSetNotation(sets: number, reps: string): string {
    return `${sets} × ${reps}`;
}

function parseLogMarkerOverrides(notes: string | null | undefined): WorkoutLogOverride {
    if (!notes) return {};

    const override: WorkoutLogOverride = {};

    const markerRegex = /\[tb:(status|key|strength|day|slot|session):\s*([a-z0-9_\/-]+)\]/gi;
    const matches = [...notes.matchAll(markerRegex)];

    const statusMap: Record<string, TrainingBlockWorkoutStatus> = {
        as_written: 'as_written',
        modified: 'modified',
        swapped: 'swapped',
        partial: 'partial',
        skipped: 'skipped',
        'as-written': 'as_written',
        'aswritten': 'as_written',
    };

    const keyCreditMap: Record<string, TrainingBlockKeySessionCredit> = {
        yes: 'yes',
        partial: 'partial',
        no: 'no',
        n_a: 'n_a',
        na: 'n_a',
        'n/a': 'n_a',
    };

    const strengthMap: Record<string, TrainingBlockStrengthStatus> = {
        completed: 'completed',
        modified: 'modified',
        partial: 'partial',
        skipped: 'skipped',
        not_started: 'not_started',
        notstarted: 'not_started',
        not_scheduled: 'not_scheduled',
        notscheduled: 'not_scheduled',
        'not-scheduled': 'not_scheduled',
    };

    const daySlotAlias: Record<string, number> = {
        d1: 0,
        day1: 0,
        d2: 1,
        day2: 1,
        d3: 2,
        day3: 2,
        d4: 3,
        day4: 3,
        d5: 4,
        day5: 4,
        d6: 5,
        day6: 5,
        d7: 6,
        day7: 6,
    };

    for (const [, field, rawValue] of matches) {
        const value = rawValue.trim().toLowerCase();

        if (field === 'status' && statusMap[value]) {
            override.status = statusMap[value];
        }
        if (field === 'key' && keyCreditMap[value]) {
            override.key_session_credit = keyCreditMap[value];
        }
        if (field === 'strength' && strengthMap[value]) {
            override.strength_status = strengthMap[value];
        }
        if (field === 'slot') {
            const parsed = Number.parseInt(value, 10);
            if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 6) {
                override.planned_day_slot = parsed;
            }
        }
        if (field === 'day') {
            if (daySlotAlias[value] !== undefined) {
                override.planned_day_slot = daySlotAlias[value];
            }
        }
        if (field === 'session') {
            override.planned_session_key = value;
        }
    }

    return override;
}

function getDefaultPlanDate(trainingPlan = STATIC_TRAINING_BLOCK_PLAN): string {
    const today = localDateString(new Date());

    if (today < trainingPlan.start_date) {
        return trainingPlan.days[0].date;
    }

    if (today > trainingPlan.end_date) {
        return trainingPlan.days[trainingPlan.days.length - 1].date;
    }

    const exactMatch = trainingPlan.days.find((day) => day.date === today);
    if (exactMatch) return exactMatch.date;

    const firstPastIndex = trainingPlan.days.findIndex((day) => day.date > today);
    if (firstPastIndex > 0) return trainingPlan.days[firstPastIndex - 1].date;

    return trainingPlan.days[trainingPlan.days.length - 1].date;
}

const statusLabel: Record<TrainingBlockWorkoutStatus, string> = {
    as_written: 'As Written',
    modified: 'Modified',
    swapped: 'Swapped',
    partial: 'Partial',
    skipped: 'Skipped',
};

const statusTone: Record<TrainingBlockWorkoutStatus, {
    variant: 'success' | 'warning' | 'danger' | 'info' | 'coaching' | 'muted';
    dot: boolean;
}> = {
    as_written: { variant: 'muted', dot: true },
    modified: { variant: 'warning', dot: true },
    swapped: { variant: 'info', dot: true },
    partial: { variant: 'warning', dot: true },
    skipped: { variant: 'danger', dot: true },
};

const templateHealthIssueTone: Record<TrainingBlockTemplateHealth['issues'][number]['severity'], string> = {
    error: 'border-red-500/30 bg-red-950/20 text-red-200',
    warning: 'border-amber-500/30 bg-amber-950/20 text-amber-200',
};

const sourceLabel: Record<TrainingBlockSessionSource, string> = {
    erg: 'Erg',
    cross_training: 'Cross',
    strength: 'Strength',
    rest: 'Rest',
};

const sourceTone = {
    concept2: {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        label: 'Concept2',
    },
    manual: {
        text: 'text-blue-400',
        bg: 'bg-blue-500/10',
        label: 'Manual',
    },
};

function manualModeForSession(session: { source: TrainingBlockSessionSource }): ManualWorkoutLogMode {
    if (session.source === 'erg') return 'row';
    if (session.source === 'cross_training') return 'cross_training';
    if (session.source === 'strength') return 'strength';
    return 'support';
}

function formatPlanSlot(daySlot: number): string {
    return `Day ${daySlot + 1}`;
}

function mapLogs(logs: TrainingBlockWorkoutLogRow[], athleteNameByUserId: Map<string, string>): DayLogEvent[] {
    return logs.map((log) => {
        const workoutType = log.workout_name || 'Workout';
        const workoutName = log.manual_rwn?.trim()
            || log.canonical_name
            || workoutType;
        const athleteName = athleteNameByUserId.get(log.user_id) ?? undefined;
        const markerOverrides = parseLogMarkerOverrides(log.notes);

        const event = toTrainingBlockActualLogEvent({
            workout_id: log.id,
            date: localDateString(log.completed_at),
            source: log.source,
            distance_meters: log.distance_meters ?? undefined,
            rest_distance_meters: log.rest_distance_meters ?? undefined,
            duration_seconds: log.duration_seconds ?? undefined,
            duration_minutes: log.duration_minutes ?? undefined,
            avg_split_500m: log.avg_split_500m ?? undefined,
            perceived_exertion: log.perceived_exertion ?? undefined,
            notes: log.notes,
            workout_name: workoutName,
            canonical_name: log.canonical_name,
            manual_rwn: log.manual_rwn,
            template_id: log.template_id,
            workout_type: log.workout_type || workoutType,
            ...markerOverrides,
        });

        return {
            ...event,
            user_id: log.user_id,
            rawDateLabel: localDateString(log.completed_at),
            rawCompletedAt: log.completed_at,
            athlete_name: athleteName,
            workout_name: workoutName,
            workout_type: event.workout_type || workoutType,
        };
    });
}

export const TrainingBlock: React.FC = () => {
    const { user, isCoach, loading: authLoading } = useAuth();
    const { pathname } = useLocation();
    const {
        scopedTeamIds,
        scopedTeams,
        isLoadingTeam: isCoachingLoading,
        scopeLabel,
        isOrgWideScope,
        orgId,
    } = useScopedTeamScope();
    const isTeamContext = pathname.startsWith('/team') || pathname.startsWith('/team-management');
    const scopedTeamNameById = useMemo(() => {
        const map = new Map<string, string>();
        scopedTeams.forEach((team) => {
            map.set(team.team_id, team.team_name);
        });
        return map;
    }, [scopedTeams]);
    const [rawLogs, setRawLogs] = useState<DayLogEvent[]>([]);
    const [logOverrides, setLogOverrides] = useState<WorkoutLogOverrides>({});
    const [overridesLoaded, setOverridesLoaded] = useState(false);
    const [athleteOptions, setAthleteOptions] = useState<TeamAthleteOption[]>([]);
    const [selectedAthleteUserId, setSelectedAthleteUserId] = useState<string>('team_all');
    const [loading, setLoading] = useState(true);
    const [hasLoadedLogs, setHasLoadedLogs] = useState(false);
    const [hasLoadedEnrollment, setHasLoadedEnrollment] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
    const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [plan, setPlan] = useState(STATIC_TRAINING_BLOCK_PLAN);
    const [planSource, setPlanSource] = useState<'database' | 'static'>('static');
    const [selectedDate, setSelectedDate] = useState(getDefaultPlanDate(STATIC_TRAINING_BLOCK_PLAN));
    const [manualEntryOpen, setManualEntryOpen] = useState(false);
    const [editingManualLogId, setEditingManualLogId] = useState<string | null>(null);
    const [manualEntryForm, setManualEntryForm] = useState<ManualEntryFormState>(() => emptyManualEntryForm(getDefaultPlanDate(STATIC_TRAINING_BLOCK_PLAN), 'cross_training'));
    const [manualEntrySaving, setManualEntrySaving] = useState(false);
    const [manualEntryError, setManualEntryError] = useState<string | null>(null);
    const [supportCompletions, setSupportCompletions] = useState<SupportCompletionMap>({});
    const [supportCompletionEditor, setSupportCompletionEditor] = useState<SupportCompletionEditorState | null>(null);
    const [quickCompletionSavingKey, setQuickCompletionSavingKey] = useState<string | null>(null);
    const [isTrainingBlockActive, setTrainingBlockActive] = useState(() => readTrainingBlockActive(true));
    const [selectedTemplateId, setSelectedTemplateId] = useState<TrainingBlockPlanOptionId>(() => readSelectedTrainingBlockTemplate());
    const [publishedTemplates, setPublishedTemplates] = useState<PublishedTrainingBlockTemplateOption[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [setupOpen, setSetupOpen] = useState(false);
    const [setupTemplateKey, setSetupTemplateKey] = useState<TrainingBlockTemplateKey>(() => readSelectedTrainingBlockTemplate());
    const [setupStartDate, setSetupStartDate] = useState(() => getMondaySnappedDate());
    const [setupIntent, setSetupIntent] = useState<'activate' | 'schedule'>('activate');
    const [setupSaving, setSetupSaving] = useState(false);
    const [setupError, setSetupError] = useState<string | null>(null);
    const [trainingBlockEnrollment, setTrainingBlockEnrollment] = useState<TrainingBlockEnrollmentRow | null>(null);
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
    const [trainingBlockEnrollments, setTrainingBlockEnrollments] = useState<TrainingBlockEnrollmentRow[]>([]);
    const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
    const [resumeEnrollmentId, setResumeEnrollmentId] = useState<string | null>(null);
    const [removingEnrollmentId, setRemovingEnrollmentId] = useState<string | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const { matchingContext, isLoading: linkedWorkoutTemplatesLoading } = useTrainingBlockMatchingContext(plan);
    const [reviewPersistenceMode, setReviewPersistenceMode] = useState<'loading' | 'database' | 'local'>('loading');

    useEffect(() => {
        let cancelled = false;

        const loadTemplates = async () => {
            setTemplatesLoading(true);
            try {
                const templates = await getPublishedTrainingBlockTemplates();
                if (cancelled) return;
                setPublishedTemplates(templates);
            } catch (error) {
                console.error('Failed to load published training block templates; using static fallback', error);
                if (!cancelled) setPublishedTemplates([]);
            } finally {
                if (!cancelled) setTemplatesLoading(false);
            }
        };

        void loadTemplates();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadEnrollmentAndOverrides = async () => {
            setOverridesLoaded(false);
            setHistoryError(null);
            const fallbackPlan = buildRowing12WeekPlan();

            const loadPersistedPlan = async (templateKey: TrainingBlockTemplateKey, startDate: string) => {
                try {
                    return await getTrainingBlockPlanFromDatabase(templateKey, startDate);
                } catch (error) {
                    console.error('Failed to load training block template rows; falling back to static template', error);
                    return null;
                }
            };

            if (!user?.id) {
                const persistedPlan = await loadPersistedPlan(selectedTemplateId as TrainingBlockTemplateKey, fallbackPlan.start_date);
                if (cancelled) return;

                setPlan(persistedPlan ?? fallbackPlan);
                setPlanSource(persistedPlan ? 'database' : 'static');
                setTrainingBlockEnrollment(null);
                setSelectedEnrollmentId(null);
                setTrainingBlockEnrollments([]);
                setLogOverrides({});
                setSupportCompletions({});
                setReviewPersistenceMode('local');
                setOverridesLoaded(true);
                setHasLoadedEnrollment(true);
                return;
            }

            setEnrollmentsLoading(true);

            try {
                const enrollments = await getTrainingBlockEnrollments(user.id);
                const selectedKey = selectedTemplateId as TrainingBlockTemplateKey;
                const selectedById = selectedEnrollmentId
                    ? enrollments.find((entry) => entry.id === selectedEnrollmentId) ?? null
                    : null;
                const selectedEnrollment = enrollments.find((entry) => entry.template_key === selectedKey) ?? null;
                const activeEnrollment = enrollments.find((entry) => entry.is_active) ?? null;
                const enrollment = selectedById ?? activeEnrollment ?? selectedEnrollment ?? enrollments[0] ?? null;
                const effectiveTemplateKey = (enrollment?.template_key ?? selectedKey) as TrainingBlockTemplateKey;
                const planStartDate = enrollment?.start_date ?? fallbackPlan.start_date;
                const persistedPlan = await loadPersistedPlan(effectiveTemplateKey, planStartDate);
                const resolvedPlan = persistedPlan ?? buildRowing12WeekPlan(planStartDate);

                if (cancelled) return;

                setTrainingBlockEnrollments(enrollments);

                if (effectiveTemplateKey !== selectedKey) {
                    setSelectedTemplateId(effectiveTemplateKey);
                    writeSelectedTrainingBlockTemplate(effectiveTemplateKey);
                    setSetupTemplateKey(effectiveTemplateKey);
                }

                setPlan(resolvedPlan);
                setPlanSource(persistedPlan ? 'database' : 'static');

                if (!enrollment) {
                    setTrainingBlockEnrollment(null);
                    setSelectedEnrollmentId(null);
                    setTrainingBlockActive(false);
                    setSetupOpen(true);
                    setSetupTemplateKey(effectiveTemplateKey);
                    setSetupStartDate(getMondaySnappedDate());
                    setLogOverrides({});
                    setSupportCompletions({});
                    setReviewPersistenceMode('local');
                    return;
                }

                setTrainingBlockEnrollment(enrollment);
                if (selectedEnrollmentId !== enrollment.id) {
                    setSelectedEnrollmentId(enrollment.id);
                }
                setTrainingBlockActive(enrollment.is_active);
                writeTrainingBlockActive(enrollment.is_active);

                const [reviews, completions] = await Promise.all([
                    getTrainingBlockLogReviews(enrollment.id),
                    getTrainingBlockSupportCompletions(enrollment.id),
                ]);
                if (cancelled) return;

                setLogOverrides(Object.fromEntries(
                    reviews.map((review) => [review.workout_log_id, reviewRowToOverride(review)]),
                ));
                setSupportCompletions(Object.fromEntries(
                    completions.map((completion) => [
                        supportCompletionKey(completion.planned_week_number, completion.planned_day_slot, completion.planned_session_key),
                        completion,
                    ]),
                ));
                setReviewPersistenceMode('database');
            } catch (error) {
                console.error('Failed to load training block enrollment or reviews; falling back to local overrides', error);
                if (cancelled) return;

                setHistoryError('Could not load your training block history.');
                setPlan(fallbackPlan);
                setPlanSource('static');
                setTrainingBlockEnrollment(null);
                setSelectedEnrollmentId(null);
                setTrainingBlockEnrollments([]);
                setSupportCompletions({});
                setReviewPersistenceMode('local');

                if (typeof window !== 'undefined') {
                    try {
                        const persisted = localStorage.getItem(TRAINING_BLOCK_OVERRIDE_STORAGE_KEY);
                        const parsed = persisted ? JSON.parse(persisted) as WorkoutLogOverrides : {};
                        setLogOverrides(typeof parsed === 'object' && parsed !== null ? parsed : {});
                    } catch (localError) {
                        console.error('Failed to load local training block log overrides', localError);
                        setLogOverrides({});
                    }
                }
            } finally {
                if (!cancelled) {
                    setEnrollmentsLoading(false);
                    setOverridesLoaded(true);
                    setHasLoadedEnrollment(true);
                }
            }
        };

        void loadEnrollmentAndOverrides();

        return () => {
            cancelled = true;
        };
    }, [selectedEnrollmentId, selectedTemplateId, user?.id]);

    useEffect(() => {
        if (plan.days.some((day) => day.date === selectedDate)) return;
        setSelectedDate(getDefaultPlanDate(plan));
    }, [plan, selectedDate]);


    useEffect(() => {
        if (!overridesLoaded || reviewPersistenceMode !== 'local') return;
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(TRAINING_BLOCK_OVERRIDE_STORAGE_KEY, JSON.stringify(logOverrides));
        } catch (error) {
            console.error('Failed to save training block log overrides', error);
        }
    }, [logOverrides, overridesLoaded, reviewPersistenceMode]);

    const allLogs = useMemo(() => rawLogs.map((log) => {
        const override = logOverrides[log.workout_id];
        if (!override) {
            return log;
        }

        return {
            ...log,
            ...override,
        };
    }), [logOverrides, rawLogs]);

    const updateLogOverride = (
        workoutId: string,
        updates: WorkoutLogOverride,
    ) => {
        const { merged, next } = mergeWorkoutLogOverride(logOverrides, workoutId, updates);
        setLogOverrides(merged);

        if (reviewPersistenceMode !== 'database' || !trainingBlockEnrollment || !user?.id) {
            return;
        }

        if (!next) {
            void deleteTrainingBlockLogReview(trainingBlockEnrollment.id, workoutId).catch((error) => {
                console.error('Failed to delete training block log review', error);
            });
            return;
        }

        void upsertTrainingBlockLogReview({
            enrollmentId: trainingBlockEnrollment.id,
            userId: user.id,
            workoutLogId: workoutId,
            plannedDaySlot: next.planned_day_slot ?? null,
            plannedSessionKey: next.planned_session_key ?? null,
            status: next.status ?? null,
            keySessionCredit: next.key_session_credit ?? null,
            strengthStatus: next.strength_status ?? null,
        }).catch((error) => {
            console.error('Failed to persist training block log review', error);
        });
    };

    useEffect(() => {
        let cancelled = false;

        if (!user?.id) {
            setRawLogs([]);
            setHasLoadedLogs(true);
            return () => {
                cancelled = true;
            };
        }

        const loadLogs = async () => {
            setLoading(true);
            setError(null);

            try {
                const athleteNameByUserId = new Map<string, string>();
                const planWindowStart = `${shiftLocalDateString(plan.start_date, -1)}T00:00:00.000Z`;
                const planWindowEnd = `${shiftLocalDateString(plan.end_date, 1)}T23:59:59.999Z`;

                if (isTeamContext) {
                    if (isCoachingLoading) {
                        if (!cancelled) setLoading(false);
                        return;
                    }

                    const athletesByUser = new Map<string, TeamAthleteOption>();
                    await Promise.all(scopedTeamIds.map(async (teamId) => {
                        const teamName = scopedTeams.find((team) => team.team_id === teamId)?.team_name ?? 'Team';
                        const teamAthletes = await getAthletes(teamId);
                        teamAthletes.forEach((athlete) => {
                            const athleteUserId = athlete.user_id?.trim();
                            if (!athleteUserId) return;

                            athleteNameByUserId.set(athleteUserId, athlete.name || 'Athlete');

                            if (!athletesByUser.has(athleteUserId)) {
                                athletesByUser.set(athleteUserId, {
                                    userId: athleteUserId,
                                    name: athlete.name || 'Athlete',
                                    teamName,
                                });
                            }
                        });
                    }));

                    const athleteList = [...athletesByUser.values()].sort((a, b) => {
                        if (a.teamName.toLowerCase() < b.teamName.toLowerCase()) return -1;
                        if (a.teamName.toLowerCase() > b.teamName.toLowerCase()) return 1;
                        return a.name.localeCompare(b.name);
                    });
                    if (!cancelled) setAthleteOptions(athleteList);

                    const teamUserIds = athleteList.map((athlete) => athlete.userId);
                    if (teamUserIds.length === 0) {
                        if (!cancelled) {
                            setAthleteOptions([]);
                            setRawLogs([]);
                        }
                        return;
                    }

                    const { data, error: fetchError } = await supabase
                        .from('workout_logs')
                        .select('id, completed_at, distance_meters, rest_distance_meters, duration_seconds, duration_minutes, avg_split_500m, perceived_exertion, source, workout_name, manual_rwn, canonical_name, template_id, notes, workout_type, user_id')
                        .in('user_id', teamUserIds)
                        .gte('completed_at', planWindowStart)
                        .lte('completed_at', planWindowEnd)
                        .order('completed_at', { ascending: false })
                        .limit(2000);

                    if (fetchError) {
                        throw fetchError;
                    }

                    const mapped = (data ?? []).map(log => ({ ...log })) as TrainingBlockWorkoutLogRow[];
                    const inWindow = mapped.filter((log) => {
                        const date = localDateString(log.completed_at);
                        return date >= plan.start_date && date <= plan.end_date;
                    });

                    if (!cancelled) setRawLogs(mapLogs(inWindow, athleteNameByUserId));
                    return;
                }

                const { data, error: fetchError } = await supabase
                    .from('workout_logs')
                    .select('id, completed_at, distance_meters, rest_distance_meters, duration_seconds, duration_minutes, avg_split_500m, perceived_exertion, source, workout_name, manual_rwn, canonical_name, template_id, notes, workout_type, user_id')
                    .eq('user_id', user.id)
                    .gte('completed_at', planWindowStart)
                    .lte('completed_at', planWindowEnd)
                    .order('completed_at', { ascending: false })
                    .limit(800);

                if (fetchError) {
                    throw fetchError;
                }

                const mapped = (data ?? []).map(log => ({ ...log })) as TrainingBlockWorkoutLogRow[];
                const inWindow = mapped.filter((log) => {
                    const date = localDateString(log.completed_at);
                    return date >= plan.start_date && date <= plan.end_date;
                });

                if (!cancelled) setRawLogs(mapLogs(inWindow, athleteNameByUserId));
            } catch (err) {
                console.error('Failed to load training block logs', err);
                if (!cancelled) {
                    setError('Could not load your recent workouts. Please refresh and try again.');
                    setRawLogs([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setHasLoadedLogs(true);
                }
            }
        };

        loadLogs();

        return () => {
            cancelled = true;
        };
    }, [isTeamContext, isCoachingLoading, scopedTeamIds.join(','), user?.id, scopedTeams, plan.start_date, plan.end_date]);

    const logs = useMemo(() => {
        if (!isTeamContext) return allLogs;
        if (selectedAthleteUserId === 'team_all') return allLogs;
        return allLogs.filter((log) => log.user_id === selectedAthleteUserId);
    }, [allLogs, isTeamContext, selectedAthleteUserId]);

    const selectedAthleteName = isTeamContext
        ? selectedAthleteUserId === 'team_all'
            ? 'All team athletes'
            : athleteOptions.find((athlete) => athlete.userId === selectedAthleteUserId)?.name
        : null;

    useEffect(() => {
        if (!isTeamContext || athleteOptions.length === 0) {
            if (athleteOptions.length === 0 && isTeamContext) {
                setSelectedAthleteUserId('team_all');
            }
            return;
        }

        if (selectedAthleteUserId === 'team_all') return;
        if (!athleteOptions.some((athlete) => athlete.userId === selectedAthleteUserId)) {
            setSelectedAthleteUserId('team_all');
        }
    }, [athleteOptions, isTeamContext, selectedAthleteUserId]);

    const templateMatchingContext = useMemo(() => ({
        linkedWorkoutTemplatesById: matchingContext.linkedWorkoutTemplatesById ?? new Map(),
    }), [matchingContext]);

    const planLogSummaries = useMemo(() => {
        return summarizeWeekProgress(plan, logs, 'slot', templateMatchingContext);
    }, [logs, templateMatchingContext, plan]);

    const alignedLogsByDay = useMemo(() => {
        return alignLogsToPlanDays(plan, logs, 'slot', templateMatchingContext);
    }, [logs, templateMatchingContext, plan]);

    const daySummariesByDate = useMemo(() => {
        const byDate = new Map<string, TrainingBlockDaySummary>();
        planLogSummaries.forEach((weekSummary: TrainingBlockWeekSummary) => {
            weekSummary.day_summaries.forEach((daySummary) => {
                byDate.set(daySummary.date, daySummary);
            });
        });
        return byDate;
    }, [planLogSummaries]);

    const selectedDay = plan.days.find((entry) => entry.date === selectedDate)
        || plan.days[0];
    const selectedWeekSummary = planLogSummaries.find((weekSummary) => weekSummary.week_number === selectedDay.week_number);
    const selectedDaySummary = daySummariesByDate.get(selectedDay.date) ?? summarizeDayProgress(selectedDay, [], templateMatchingContext);
    const selectedWeekDays = plan.days.filter((entry) => entry.week_number === selectedDay.week_number);
    const selectedWeekSessionOptions = selectedWeekDays.flatMap((day) => day.sessions.map((session) => ({ day, session })));
    const selectedWeekStart = selectedWeekDays[0]?.date ?? selectedDay.date;
    const selectedWeekEnd = selectedWeekDays[selectedWeekDays.length - 1]?.date ?? selectedDay.date;
    const selectedDayKey = `${selectedDay.week_number}:${selectedDay.day_slot}`;
    const selectedDayAlignedLogs = (alignedLogsByDay.get(selectedDayKey) ?? []) as DayLogEvent[];
    const selectedDayCalendarLogs = useMemo(() => {
        return logs.filter((log) => log.rawDateLabel === selectedDay.date);
    }, [logs, selectedDay.date]);
    const selectedDayAlignedLogMatches = useMemo(() => selectedDayAlignedLogs.map((log) => ({
        log,
        match: scoreLogAgainstPlanDay(selectedDay, log, templateMatchingContext),
    })), [selectedDay, selectedDayAlignedLogs, templateMatchingContext]);
    const calendarLogCountByDate = useMemo(() => {
        const counts = new Map<string, number>();
        logs.forEach((log) => {
            counts.set(log.rawDateLabel, (counts.get(log.rawDateLabel) ?? 0) + 1);
        });
        return counts;
    }, [logs]);
    const selectedDayCalendarLogMatches = useMemo(() => selectedDayCalendarLogs.map((log) => ({
        log,
        match: scoreLogAgainstPlanDay(selectedDay, log, templateMatchingContext),
    })), [selectedDay, selectedDayCalendarLogs, templateMatchingContext]);
    const matchedLogsBySessionId = useMemo(() => {
        const bySession = new Map<string, Array<{ log: DayLogEvent; match: ReturnType<typeof scoreLogAgainstPlanDay> }>>();
        selectedDayAlignedLogMatches.forEach((entry) => {
            if (entry.log.status === 'skipped') return;
            if (!entry.match.planned_session_id) return;
            if (entry.match.relationship !== 'satisfies' && entry.match.relationship !== 'support_only') return;

            const existing = bySession.get(entry.match.planned_session_id);
            if (existing) {
                existing.push(entry);
            } else {
                bySession.set(entry.match.planned_session_id, [entry]);
            }
        });
        return bySession;
    }, [selectedDayAlignedLogMatches]);
    const supportPrepLogMatches = selectedDayAlignedLogMatches.filter(({ log, match }) => {
        if (log.status === 'skipped') return false;
        if (match.planned_session_id) return false;
        return log.notes?.toLowerCase().includes('[tb:quick:support-prep]') ?? false;
    });
    const selectedDayLoggedWorkoutEntries = selectedDayCalendarLogMatches.filter(({ log }) => !(log.source === 'manual' && (log.notes?.toLowerCase().includes('[tb:quick:') ?? false)));
    const selectedReference = selectedDay.reference;
    const defaultManualSession = selectedDay.sessions.find((session) => session.source === 'cross_training')
        ?? selectedDay.sessions.find((session) => session.source === 'strength')
        ?? selectedDay.sessions.find((session) => session.source === 'erg')
        ?? selectedDay.sessions[0];
    const defaultManualMode: ManualWorkoutLogMode = defaultManualSession
        ? manualModeForSession(defaultManualSession)
        : 'support';
    const defaultManualRWN = defaultManualSession?.planned_rwn ?? '';
    const availableTemplates = publishedTemplates.length > 0 ? publishedTemplates : [STATIC_TEMPLATE_OPTION];
    const selectedTemplate = availableTemplates.find((template) => template.template_key === selectedTemplateId) ?? STATIC_TEMPLATE_OPTION;
    const setupTemplate = availableTemplates.find((template) => template.template_key === setupTemplateKey) ?? selectedTemplate ?? STATIC_TEMPLATE_OPTION;
    const activePersonalEnrollment = trainingBlockEnrollments.find((entry) => entry.is_active) ?? null;
    const nextBlockStartDate = activePersonalEnrollment ? shiftLocalDateString(activePersonalEnrollment.end_date, 1) : null;
    const setupEndDate = computeTrainingBlockEndDate(setupStartDate, setupTemplate.duration_weeks);
    const templateNameByKey = new Map(availableTemplates.map((template) => [template.template_key, template.name]));
    const getTemplateName = (templateKey: string): string => templateNameByKey.get(templateKey as TrainingBlockTemplateKey) ?? templateKey;
    const lifecycleStatus = trainingBlockEnrollment
        ? getEnrollmentLifecycleStatus(trainingBlockEnrollment)
        : 'preview';
    const lifecycleBadgeVariant = lifecycleStatusTone[lifecycleStatus];
    const templateHealth = useMemo(() => validateTrainingBlockTemplate(plan, {
        source: planSource,
        linkedWorkoutTemplatesById: templateMatchingContext.linkedWorkoutTemplatesById ?? new Map(),
    }), [templateMatchingContext, plan, planSource]);
    const canCreateManualEntry = Boolean(trainingBlockEnrollment) && isTrainingBlockActive && (!isTeamContext || selectedAthleteUserId === user?.id);
    const manualEntryUsesRWN = manualEntryForm.mode === 'row' || manualEntryForm.mode === 'cross_training';
    const manualEntryUsesDistance = manualEntryForm.mode === 'row' || manualEntryForm.mode === 'cross_training';
    const defaultRWNForManualMode = (mode: ManualWorkoutLogMode): string => {
        if (mode === 'row') {
            return selectedDay.sessions.find((session) => session.source === 'erg')?.planned_rwn ?? '';
        }
        if (mode === 'cross_training') {
            return selectedDay.sessions.find((session) => session.source === 'cross_training')?.planned_rwn ?? 'Cross: 60:00';
        }
        return '';
    };

    const openManualEntry = () => {
        if (!canCreateManualEntry) return;
        setManualEntryError(null);
        setEditingManualLogId(null);
        setManualEntryForm(emptyManualEntryForm(selectedDay.date, defaultManualMode, defaultManualRWN, defaultManualSession?.id ?? ''));
        setManualEntryOpen(true);
    };

    const closeManualEntry = () => {
        setManualEntryOpen(false);
        setEditingManualLogId(null);
        setManualEntryError(null);
    };

    const openManualLogEdit = (log: DayLogEvent) => {
        if (!canCreateManualEntry || log.source !== 'manual' || log.user_id !== user?.id || isTrainingBlockQuickLog(log)) return;
        setManualEntryError(null);
        setEditingManualLogId(log.workout_id);
        setManualEntryForm({
            mode: (log.workout_type === 'row' || log.workout_type === 'cross_training' || log.workout_type === 'strength' || log.workout_type === 'support')
                ? log.workout_type
                : 'support',
            plannedSessionId: log.planned_session_key ?? '',
            completedDate: log.date,
            completedTime: formatInputTime(log.rawCompletedAt),
            manualRWN: log.manual_rwn ?? '',
            distanceMetersInput: log.distance_meters ? String(Math.round(log.distance_meters)) : '',
            durationMinutes: log.duration_seconds ? String(Math.round((log.duration_seconds / 60) * 10) / 10) : '',
            avgSplit: log.avg_split_500m ? formatSplit(log.avg_split_500m) : '',
            perceivedExertion: log.perceived_exertion ? String(log.perceived_exertion) : '',
            notes: log.notes?.replace(/\s*\[tb:[^\]]+\]/g, '').trim() ?? '',
            rowingOptIn: log.workout_type === 'row',
        });
        setManualEntryOpen(true);
    };

    const updateTrainingBlockActive = (value: boolean) => {
        if (value && !trainingBlockEnrollment) {
            setSetupOpen(true);
            return;
        }

        setTrainingBlockActive(value);
        writeTrainingBlockActive(value);
        if (!value) {
            closeManualEntry();
        }

        if (!user?.id || !trainingBlockEnrollment) return;

        void ensureTrainingBlockEnrollment({
            userId: user.id,
            templateKey: selectedTemplateId as TrainingBlockTemplateKey,
            enrollmentId: trainingBlockEnrollment.id,
            startDate: plan.start_date,
            endDate: plan.end_date,
            isActive: value,
        }).then(async (enrollment) => {
            setTrainingBlockEnrollment(enrollment);
            setSelectedEnrollmentId(enrollment.id);
            setTrainingBlockEnrollments(await getTrainingBlockEnrollments(user.id));
            setReviewPersistenceMode('database');
        }).catch((error) => {
            console.error('Failed to persist training block active state', error);
            setReviewPersistenceMode('local');
        });
    };

    const openSetup = () => {
        setSetupError(null);
        setSetupIntent('activate');
        setSetupTemplateKey(selectedTemplateId as TrainingBlockTemplateKey);
        setSetupStartDate(trainingBlockEnrollment?.start_date ?? getMondaySnappedDate());
        setSetupOpen(true);
    };

    const viewTrainingBlockEnrollment = (enrollment: TrainingBlockEnrollmentRow) => {
        setSetupOpen(false);
        setHistoryError(null);
        setSelectedEnrollmentId(enrollment.id);
        setSelectedTemplateId(enrollment.template_key);
        writeSelectedTrainingBlockTemplate(enrollment.template_key);
    };

    const removeTrainingBlockEnrollment = async (enrollment: TrainingBlockEnrollmentRow) => {
        if (!user?.id) return;

        const confirmed = window.confirm('Remove this training block enrollment? This removes the block schedule, review decisions, and support completion checks for this block. It will not delete workout logs.');
        if (!confirmed) return;

        setRemovingEnrollmentId(enrollment.id);
        setHistoryError(null);

        try {
            await deleteTrainingBlockEnrollment(user.id, enrollment.id);
            const enrollments = await getTrainingBlockEnrollments(user.id);
            setTrainingBlockEnrollments(enrollments);

            if (trainingBlockEnrollment?.id !== enrollment.id) {
                return;
            }

            const nextEnrollment = enrollments.find((entry) => entry.is_active) ?? enrollments[0] ?? null;
            if (nextEnrollment) {
                setSelectedEnrollmentId(nextEnrollment.id);
                setSelectedTemplateId(nextEnrollment.template_key);
                writeSelectedTrainingBlockTemplate(nextEnrollment.template_key);
                return;
            }

            setTrainingBlockEnrollment(null);
            setSelectedEnrollmentId(null);
            setTrainingBlockActive(false);
            writeTrainingBlockActive(false);
            setLogOverrides({});
            setSupportCompletions({});
            setReviewPersistenceMode('local');
            setSetupOpen(true);
            setSetupTemplateKey(selectedTemplateId as TrainingBlockTemplateKey);
            setSetupStartDate(getMondaySnappedDate());
        } catch (error) {
            console.error('Failed to remove training block enrollment', error);
            setHistoryError('Could not remove this training block. Please try again.');
        } finally {
            setRemovingEnrollmentId(null);
        }
    };

    const resumeTrainingBlockEnrollment = async (enrollment: TrainingBlockEnrollmentRow) => {
        if (!user?.id) return;

        setResumeEnrollmentId(enrollment.id);
        setHistoryError(null);

        try {
            const templateKey = enrollment.template_key as TrainingBlockTemplateKey;
            const persistedPlan = await getTrainingBlockPlanFromDatabase(templateKey, enrollment.start_date).catch((error) => {
                console.error('Failed to load selected training block template rows while resuming; falling back to static template', error);
                return null;
            });
            if (!persistedPlan && templateKey !== ROWING_12_WEEK_TEMPLATE.template_id) {
                throw new Error(`No persisted training block template found for ${templateKey}`);
            }

            const resolvedPlan = persistedPlan ?? buildRowing12WeekPlan(enrollment.start_date);
            const updatedEnrollment = await ensureTrainingBlockEnrollment({
                userId: user.id,
                templateKey,
                templateId: enrollment.template_id,
                enrollmentId: enrollment.id,
                startDate: enrollment.start_date,
                endDate: enrollment.end_date,
                isActive: true,
                status: 'active',
            });
            const [reviews, completions, enrollments] = await Promise.all([
                getTrainingBlockLogReviews(updatedEnrollment.id),
                getTrainingBlockSupportCompletions(updatedEnrollment.id),
                getTrainingBlockEnrollments(user.id),
            ]);

            setSelectedTemplateId(templateKey);
            writeSelectedTrainingBlockTemplate(templateKey);
            setPlan(resolvedPlan);
            setPlanSource(persistedPlan ? 'database' : 'static');
            setTrainingBlockEnrollment(updatedEnrollment);
            setSelectedEnrollmentId(updatedEnrollment.id);
            setTrainingBlockEnrollments(enrollments);
            setTrainingBlockActive(true);
            writeTrainingBlockActive(true);
            setLogOverrides(Object.fromEntries(
                reviews.map((review) => [review.workout_log_id, reviewRowToOverride(review)]),
            ));
            setSupportCompletions(Object.fromEntries(
                completions.map((completion) => [
                    supportCompletionKey(completion.planned_week_number, completion.planned_day_slot, completion.planned_session_key),
                    completion,
                ]),
            ));
            setReviewPersistenceMode('database');
            setSelectedDate(getDefaultPlanDate(resolvedPlan));
            setSetupOpen(false);
        } catch (error) {
            console.error('Failed to resume training block enrollment', error);
            setHistoryError('Could not resume this training block.');
        } finally {
            setResumeEnrollmentId(null);
        }
    };

    const saveTrainingBlockSetup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user?.id) return;

        const template = availableTemplates.find((entry) => entry.template_key === setupTemplateKey) ?? STATIC_TEMPLATE_OPTION;
        const startDate = setupStartDate;
        const today = toTrainingBlockLocalDate(new Date());
        const activeEnrollment = trainingBlockEnrollments.find((entry) => entry.is_active) ?? null;

        setSetupSaving(true);
        setSetupError(null);

        try {
            if (setupIntent === 'schedule') {
                if (startDate <= today) {
                    throw new Error('scheduled_start_not_future');
                }

                if (activeEnrollment && startDate <= activeEnrollment.end_date) {
                    throw new Error('scheduled_start_overlaps_active');
                }
            }

            const persistedPlan = await getTrainingBlockPlanFromDatabase(template.template_key, startDate).catch((error) => {
                console.error('Failed to load selected training block template rows; falling back to static template', error);
                return null;
            });
            if (!persistedPlan && template.template_key !== ROWING_12_WEEK_TEMPLATE.template_id) {
                throw new Error(`No persisted training block template found for ${template.template_key}`);
            }

            const resolvedPlan = persistedPlan ?? buildRowing12WeekPlan(startDate);
            const enrollmentInput = {
                userId: user.id,
                templateKey: template.template_key,
                templateId: template.source === 'static_fallback' ? null : template.id,
                startDate: resolvedPlan.start_date,
                endDate: resolvedPlan.end_date,
            };
            const enrollment = setupIntent === 'schedule'
                ? await createTrainingBlockEnrollment({
                    ...enrollmentInput,
                    isActive: false,
                    status: 'scheduled',
                })
                : await ensureTrainingBlockEnrollment({
                    ...enrollmentInput,
                    isActive: true,
                    status: 'active',
                });
            const [reviews, completions, enrollments] = await Promise.all([
                getTrainingBlockLogReviews(enrollment.id),
                getTrainingBlockSupportCompletions(enrollment.id),
                getTrainingBlockEnrollments(user.id),
            ]);

            setTrainingBlockEnrollments(enrollments);

            if (setupIntent === 'schedule' && activeEnrollment) {
                setSelectedEnrollmentId(activeEnrollment.id);
                setSetupOpen(false);
                return;
            }

            setSelectedTemplateId(template.template_key);
            writeSelectedTrainingBlockTemplate(template.template_key);
            setPlan(resolvedPlan);
            setPlanSource(persistedPlan ? 'database' : 'static');
            setTrainingBlockEnrollment(enrollment);
            setSelectedEnrollmentId(enrollment.id);
            setTrainingBlockActive(enrollment.is_active);
            writeTrainingBlockActive(enrollment.is_active);
            setLogOverrides(Object.fromEntries(
                reviews.map((review) => [review.workout_log_id, reviewRowToOverride(review)]),
            ));
            setSupportCompletions(Object.fromEntries(
                completions.map((completion) => [
                    supportCompletionKey(completion.planned_week_number, completion.planned_day_slot, completion.planned_session_key),
                    completion,
                ]),
            ));
            setReviewPersistenceMode('database');
            setSelectedDate(getDefaultPlanDate(resolvedPlan));
            setSetupOpen(false);
        } catch (error) {
            console.error('Failed to save training block setup', error);
            if (error instanceof Error && error.message === 'scheduled_start_not_future') {
                setSetupError('Scheduled blocks need a future start date. Choose a date after today.');
            } else if (error instanceof Error && error.message === 'scheduled_start_overlaps_active') {
                setSetupError('Schedule the next block after your current active block ends, or activate it now to replace the current block.');
            } else {
                setSetupError(setupIntent === 'schedule'
                    ? 'Could not schedule this training block. Please try again.'
                    : 'Could not start this training block. Please try again.');
            }
        } finally {
            setSetupSaving(false);
        }
    };


    const updateManualEntryForm = <Key extends keyof ManualEntryFormState>(key: Key, value: ManualEntryFormState[Key]) => {
        setManualEntryForm((prev) => ({ ...prev, [key]: value }));
    };

    const updateManualEntryMode = (mode: ManualWorkoutLogMode) => {
        const modeUsesRWN = mode === 'row' || mode === 'cross_training';
        const modeUsesDistance = mode === 'row' || mode === 'cross_training';
        setManualEntryForm((prev) => ({
            ...prev,
            mode,
            plannedSessionId: '',
            manualRWN: modeUsesRWN ? (prev.manualRWN.trim() ? prev.manualRWN : defaultRWNForManualMode(mode)) : '',
            distanceMetersInput: modeUsesDistance ? prev.distanceMetersInput : '',
            avgSplit: mode === 'row' ? prev.avgSplit : '',
            rowingOptIn: mode === 'row' ? prev.rowingOptIn : false,
        }));
    };

    const updateManualEntrySession = (sessionId: string) => {
        const session = selectedDay.sessions.find((entry) => entry.id === sessionId);
        if (!session) {
            setManualEntryForm((prev) => ({ ...prev, plannedSessionId: '' }));
            return;
        }

        const mode = manualModeForSession(session);
        const modeUsesDistance = mode === 'row' || mode === 'cross_training';
        setManualEntryForm((prev) => ({
            ...prev,
            plannedSessionId: session.id,
            mode,
            manualRWN: session.planned_rwn ?? defaultRWNForManualMode(mode),
            distanceMetersInput: modeUsesDistance ? prev.distanceMetersInput : '',
            avgSplit: mode === 'row' ? prev.avgSplit : '',
            rowingOptIn: mode === 'row' ? prev.rowingOptIn : false,
        }));
    };

    const saveManualEntry = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user?.id) return;
        if (!canCreateManualEntry) {
            setManualEntryError('Manual entries can only be created for your own account.');
            return;
        }
        if (manualEntryForm.mode === 'row' && !manualEntryForm.rowingOptIn) {
            setManualEntryError('Confirm that you want to manually enter a rowing workout instead of using Concept2 sync.');
            return;
        }
        if (manualEntryForm.mode === 'row' && !manualEntryForm.manualRWN.trim()) {
            setManualEntryError('Rowing manual entries need an RWN structure so they can match history and plan work.');
            return;
        }

        const distanceMetersInput = manualEntryUsesDistance ? parseOptionalPositiveNumber(manualEntryForm.distanceMetersInput) : null;
        const durationMinutes = parseOptionalPositiveNumber(manualEntryForm.durationMinutes);
        const avgSplitSeconds = manualEntryForm.mode === 'row' ? parsePaceToSeconds(manualEntryForm.avgSplit) : null;
        const perceivedExertion = parseOptionalPositiveNumber(manualEntryForm.perceivedExertion);
        const distanceMeters = distanceMetersInput ? Math.round(distanceMetersInput) : null;
        const durationSeconds = durationMinutes
            ? Math.round(durationMinutes * 60)
            : distanceMeters && avgSplitSeconds
                ? Math.round((distanceMeters / 500) * avgSplitSeconds)
                : null;
        const avgSplit500m = avgSplitSeconds
            ?? (manualEntryForm.mode === 'row' && distanceMeters && durationSeconds
                ? durationSeconds / (distanceMeters / 500)
                : null);

        setManualEntrySaving(true);
        setManualEntryError(null);

        try {
            const payload = {
                userId: user.id,
                completedAt: formatInputDateTime(manualEntryForm.completedDate, manualEntryForm.completedTime),
                mode: manualEntryForm.mode,
                manualRWN: manualEntryUsesRWN ? manualEntryForm.manualRWN : null,
                distanceMeters,
                durationSeconds,
                avgSplit500m,
                perceivedExertion,
                notes: manualEntryForm.notes,
                plannedWeekNumber: selectedDay.week_number,
                plannedDaySlot: selectedDay.day_slot,
                plannedSessionKey: manualEntryForm.plannedSessionId || null,
            };

            const saved = editingManualLogId
                ? await workoutService.updateManualWorkoutLog(editingManualLogId, payload)
                : await workoutService.createManualWorkoutLog(payload);
            const mapped = mapLogs([saved as TrainingBlockWorkoutLogRow], new Map())[0];

            setRawLogs((prev) => editingManualLogId
                ? prev.map((entry) => entry.workout_id === editingManualLogId ? mapped : entry)
                : [mapped, ...prev]);
            closeManualEntry();
        } catch (err) {
            console.error('Failed to save manual training block log', err);
            setManualEntryError('Could not save the manual workout. Please check the fields and try again.');
        } finally {
            setManualEntrySaving(false);
        }
    };

    const getPlannedSessionCompletionLog = (sessionId: string): DayLogEvent | null => {
        return selectedDayAlignedLogs.find((log) => {
            const match = scoreLogAgainstPlanDay(selectedDay, log, templateMatchingContext);
            if (match.planned_session_id !== sessionId) return false;
            return match.relationship === 'satisfies' || match.relationship === 'support_only';
        }) ?? null;
    };

    const getSupportCompletion = (plannedSessionKey: string): TrainingBlockSupportCompletionRow | null => {
        return supportCompletions[supportCompletionKey(selectedDay.week_number, selectedDay.day_slot, plannedSessionKey)] ?? null;
    };

    const getSupportCompletionStatus = (plannedSessionKey: string): TrainingBlockSupportCompletionStatus | null => {
        const completion = getSupportCompletion(plannedSessionKey);
        if (completion) return completion.status;
        if (plannedSessionKey === 'support-prep') return getSupportPrepCompletionLog() ? 'completed' : null;
        return getPlannedSessionCompletionLog(plannedSessionKey) ? 'completed' : null;
    };

    const isTrainingBlockQuickLog = (log: DayLogEvent): boolean => {
        return log.source === 'manual' && (log.notes?.toLowerCase().includes('[tb:quick:') ?? false);
    };

    const isQuickCompletionLog = (log: DayLogEvent, key: string, title: string): boolean => {
        if (log.source !== 'manual') return false;
        const notes = log.notes?.toLowerCase() ?? '';
        const titleMarker = `${title} complete`.toLowerCase();
        if (notes.includes(`[tb:quick:${key.toLowerCase()}]`)) return true;
        if (key === 'support-prep') {
            return notes.includes('support prep complete') || notes.includes('core complete') || notes.includes('mobility complete');
        }
        return log.workout_type === 'strength' && notes.includes(titleMarker) && notes.includes('[tb:strength:completed]');
    };

    const getSupportPrepCompletionLog = (): DayLogEvent | null => {
        return selectedDayAlignedLogs.find((log) => isQuickCompletionLog(log, 'support-prep', 'Support prep')) ?? null;
    };

    const isSupportPrepComplete = Boolean(getSupportCompletionStatus('support-prep'));

    const saveSupportCompletion = async (target: SupportCompletionTarget): Promise<boolean> => {
        if (!user?.id || !canCreateManualEntry || !trainingBlockEnrollment) return false;

        setQuickCompletionSavingKey(target.plannedSessionKey);
        setManualEntryError(null);

        try {
            const saved = await upsertTrainingBlockSupportCompletion({
                enrollmentId: trainingBlockEnrollment.id,
                userId: user.id,
                templateSessionId: null,
                plannedWeekNumber: selectedDay.week_number,
                plannedDaySlot: selectedDay.day_slot,
                plannedSessionKey: target.plannedSessionKey,
                scheduledDate: selectedDay.date,
                supportSessionTemplateId: target.supportSessionTemplateId ?? null,
                status: target.status,
                minutesCompleted: target.minutesCompleted ?? null,
                perceivedExertion: target.perceivedExertion ?? null,
                painFlag: target.painFlag ?? false,
                notes: target.notes ?? null,
            });

            setSupportCompletions((prev) => ({
                ...prev,
                [supportCompletionKey(saved.planned_week_number, saved.planned_day_slot, saved.planned_session_key)]: saved,
            }));
            return true;
        } catch (err) {
            console.error('Failed to save support completion', err);
            setManualEntryError('Could not save the support completion. Please try again.');
            return false;
        } finally {
            setQuickCompletionSavingKey(null);
        }
    };

    const removeSupportCompletion = async (plannedSessionKey: string) => {
        if (!user?.id || !canCreateManualEntry || !trainingBlockEnrollment) return;

        setQuickCompletionSavingKey(plannedSessionKey);
        setManualEntryError(null);

        try {
            await deleteTrainingBlockSupportCompletion(
                trainingBlockEnrollment.id,
                selectedDay.week_number,
                selectedDay.day_slot,
                plannedSessionKey,
            );
            setSupportCompletions((prev) => {
                const next = { ...prev };
                delete next[supportCompletionKey(selectedDay.week_number, selectedDay.day_slot, plannedSessionKey)];
                return next;
            });
        } catch (err) {
            console.error('Failed to remove support completion', err);
            setManualEntryError('Could not clear the support completion. Please try again.');
        } finally {
            setQuickCompletionSavingKey(null);
        }
    };

    const openSupportCompletionEditor = (session: TrainingBlockPlannedSession, status: TrainingBlockSupportCompletionStatus = 'modified') => {
        const completion = getSupportCompletion(session.id);
        setSupportCompletionEditor({
            session,
            form: emptySupportCompletionForm(status, completion),
        });
    };

    const closeSupportCompletionEditor = () => {
        setSupportCompletionEditor(null);
    };

    const updateSupportCompletionForm = <Key extends keyof SupportCompletionFormState>(key: Key, value: SupportCompletionFormState[Key]) => {
        setSupportCompletionEditor((prev) => prev
            ? { ...prev, form: { ...prev.form, [key]: value } }
            : prev);
    };

    const saveSupportCompletionEditor = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!supportCompletionEditor) return;

        const minutesCompleted = parseOptionalPositiveNumber(supportCompletionEditor.form.minutesCompleted);
        const perceivedExertion = parseOptionalPositiveNumber(supportCompletionEditor.form.perceivedExertion);

        const saved = await saveSupportCompletion({
            plannedSessionKey: supportCompletionEditor.session.id,
            supportSessionTemplateId: supportCompletionEditor.session.support_session_template_id ?? null,
            status: supportCompletionEditor.form.status,
            minutesCompleted: minutesCompleted ? Math.round(minutesCompleted) : null,
            perceivedExertion: perceivedExertion ? Math.round(perceivedExertion) : null,
            painFlag: supportCompletionEditor.form.painFlag,
            notes: supportCompletionEditor.form.notes.trim() || null,
        });
        if (saved) closeSupportCompletionEditor();
    };

    const removeManualWorkoutLog = async (log: DayLogEvent) => {
        if (!user?.id || log.source !== 'manual' || log.user_id !== user.id || isTeamContext) return;
        const quickLog = isTrainingBlockQuickLog(log);
        const confirmed = quickLog || window.confirm('Remove this manual workout log from your training history?');
        if (!confirmed) return;

        setQuickCompletionSavingKey(log.workout_id);
        setManualEntryError(null);

        try {
            await workoutService.deleteManualWorkoutLog(log.workout_id, user.id);
            if (trainingBlockEnrollment) {
                await deleteTrainingBlockLogReview(trainingBlockEnrollment.id, log.workout_id).catch(() => undefined);
            }
            setRawLogs((prev) => prev.filter((entry) => entry.workout_id !== log.workout_id));
            setLogOverrides((prev) => {
                const next = { ...prev };
                delete next[log.workout_id];
                return next;
            });
        } catch (err) {
            console.error('Failed to remove manual training block log', err);
            setManualEntryError('Could not remove the manual log. Please try again.');
        } finally {
            setQuickCompletionSavingKey(null);
        }
    };



    useEffect(() => {
        if (!isTeamContext) {
            if (teamAssignments.length > 0) {
                setTeamAssignments([]);
            }
            setAssignmentsLoading(false);
            return;
        }

        if (isCoachingLoading) {
            return;
        }

        if (scopedTeamIds.length === 0 || !selectedWeekStart || !selectedWeekEnd) {
            setTeamAssignments([]);
            return;
        }

        const loadAssignments = async () => {
            setAssignmentsLoading(true);
            setAssignmentsError(null);

            try {
                const queryTeamIds = isOrgWideScope && orgId
                    ? scopedTeamIds.slice(0, 1)
                    : scopedTeamIds;
                const queryOptions = isOrgWideScope && orgId
                    ? { from: selectedWeekStart, to: selectedWeekEnd, orgId }
                    : { from: selectedWeekStart, to: selectedWeekEnd };

                const fetched = await Promise.all(queryTeamIds.map((teamId) => getGroupAssignments(teamId, queryOptions)));
                const flattened = fetched.flat().map((assignment) => {
                    const teamName = assignment.team_id
                        ? scopedTeamNameById.get(assignment.team_id) ?? 'Team'
                        : 'Organization';
                    const assignmentScope: TeamAssignment['assignmentScope'] = assignment.team_id ? 'team' : 'org';

                    return {
                        ...assignment,
                        teamName,
                        assignmentScope,
                    };
                });

                const nextAssignments = new Map<string, TeamAssignment>();
                for (const assignment of flattened) {
                    if (!nextAssignments.has(assignment.id)) {
                        nextAssignments.set(assignment.id, assignment);
                    }
                }

                setTeamAssignments(Array.from(nextAssignments.values()).sort((a, b) => {
                    const scheduledDateComparison = a.scheduled_date.localeCompare(b.scheduled_date);
                    if (scheduledDateComparison !== 0) return scheduledDateComparison;
                    return a.created_at.localeCompare(b.created_at);
                }));
            } catch (err) {
                console.error('Failed to load team assignments for training block', err);
                setTeamAssignments([]);
                setAssignmentsError('Could not load team-workout assignments for this week. Team assignment data may be incomplete.');
            } finally {
                setAssignmentsLoading(false);
            }
        };

        void loadAssignments();
    }, [
        isTeamContext,
        isCoachingLoading,
        isOrgWideScope,
        orgId,
        scopedTeamIds.join(','),
        selectedWeekEnd,
        selectedWeekStart,
        scopedTeamNameById,
    ]);

    const weekCoverage = selectedWeekSummary
        ? Math.min(100, Math.round(selectedWeekSummary.target_coverage_ratio * 100))
        : 0;

    const selectedWeekLoad = selectedWeekSummary
        ? selectedWeekSummary.day_summaries.reduce((sum, daySummary) => sum + (daySummary.training_load ?? 0), 0)
        : 0;

    const dayLoad = selectedDaySummary.training_load ?? 0;
    const dayActualDistance = selectedDaySummary.actual_distance_meters;
    const scopeTeamText = isTeamContext
        ? isOrgWideScope
            ? scopeLabel || 'Organization scope'
            : scopeLabel || 'Team scope'
        : 'Personal scope';
    const selectedAthleteLabel = isTeamContext ? selectedAthleteName ?? 'All team athletes' : 'Your workouts';
    const selectedScopeWeek = selectedDay.week_number;
    const teamAthleteScopeSummary = useMemo(() => {
        if (!isTeamContext || athleteOptions.length === 0) {
            return [];
        }

        const logsByAthlete = new Map<string, DayLogEvent[]>();
        allLogs.forEach((log) => {
            const list = logsByAthlete.get(log.user_id);
            if (list) {
                list.push(log);
            } else {
                logsByAthlete.set(log.user_id, [log]);
            }
        });

        return athleteOptions
            .map((athlete) => {
                const athleteLogs = logsByAthlete.get(athlete.userId) ?? [];
                const weekSummaries = summarizeWeekProgress(plan, athleteLogs, 'slot', templateMatchingContext);
                const athleteWeekSummary = weekSummaries.find((week) => week.week_number === selectedScopeWeek);
                const weekCoverage = athleteWeekSummary
                    ? Math.min(100, Math.round(athleteWeekSummary.target_coverage_ratio * 100))
                    : 0;

                return {
                    athleteUserId: athlete.userId,
                    athleteName: athlete.name,
                    teamName: athlete.teamName,
                    coveredSlots: athleteWeekSummary
                        ? athleteWeekSummary.day_summaries.filter((day) => day.logged_session_count > 0).length
                        : 0,
                    weekCoverage,
                    actualDistance: athleteWeekSummary?.actual_distance_meters ?? 0,
                    targetDistance: athleteWeekSummary?.target_distance_meters ?? 0,
                    keySessionCreditText: athleteWeekSummary
                        ? `${athleteWeekSummary.key_session_credits.earned}/${athleteWeekSummary.key_session_credits.possible}`
                        : '0/0',
                };
            })
            .sort((a, b) => b.weekCoverage - a.weekCoverage || a.athleteName.localeCompare(b.athleteName));
    }, [
        isTeamContext,
        athleteOptions,
        allLogs,
        plan,
        selectedScopeWeek,
        templateMatchingContext,
    ]);
    const selectedWeekAssignments = useMemo(() => {
        if (teamAssignments.length === 0) return [];

        return teamAssignments.filter((assignment) => assignment.scheduled_date >= selectedWeekStart && assignment.scheduled_date <= selectedWeekEnd);
    }, [selectedWeekEnd, selectedWeekStart, teamAssignments]);

    const selectedWeekAssignmentMatches = useMemo(() => {
        const matches = new Map<string, ReturnType<typeof scoreAssignmentAgainstPlanWeek>>();
        selectedWeekAssignments.forEach((assignment) => {
            matches.set(assignment.id, scoreAssignmentAgainstPlanWeek(selectedWeekDays, assignment, templateMatchingContext));
        });
        return matches;
    }, [selectedWeekAssignments, selectedWeekDays, templateMatchingContext]);

    const selectedDayAssignments = useMemo(() => {
        return selectedWeekAssignments.filter((assignment) => assignment.scheduled_date === selectedDay.date);
    }, [selectedDay.date, selectedWeekAssignments]);

    const getReviewAssignmentValue = (log: DayLogEvent): string => {
        if (log.status === 'skipped') return DOES_NOT_COUNT_VALUE;
        if (!log.planned_session_key) return AUTO_OVERRIDE_VALUE;

        const manualSessionOption = selectedWeekSessionOptions.find(({ session }) => session.id === log.planned_session_key);
        return manualSessionOption
            ? `${manualSessionOption.day.day_slot}|${manualSessionOption.session.id}`
            : AUTO_OVERRIDE_VALUE;
    };

    const applyReviewAssignmentValue = (log: DayLogEvent, value: string): void => {
        if (value === AUTO_OVERRIDE_VALUE) {
            updateLogOverride(log.workout_id, {
                planned_session_key: undefined,
                planned_day_slot: undefined,
                status: log.status === 'skipped' ? undefined : log.status,
            });
            return;
        }

        if (value === DOES_NOT_COUNT_VALUE) {
            updateLogOverride(log.workout_id, {
                planned_session_key: undefined,
                planned_day_slot: undefined,
                status: 'skipped',
            });
            return;
        }

        const [slotValue, sessionKey] = value.split('|');
        updateLogOverride(log.workout_id, {
            planned_day_slot: Number.parseInt(slotValue, 10),
            planned_session_key: sessionKey,
            status: log.status === 'skipped' ? undefined : log.status,
        });
    };

    const assignmentsByDate = useMemo(() => {
        const byDate = new Map<string, TeamAssignment[]>();
        selectedWeekAssignments.forEach((assignment) => {
            const list = byDate.get(assignment.scheduled_date);
            if (list) {
                list.push(assignment);
            } else {
                byDate.set(assignment.scheduled_date, [assignment]);
            }
        });

        return byDate;
    }, [selectedWeekAssignments]);

    const teamHomePath = pathname.startsWith('/team-management') ? '/team-management' : '/team';
    const teamSettingsPath = pathname.startsWith('/team-management') ? '/team-management/settings' : '/team/settings';
    const selectedWeekAssignmentCount = selectedWeekAssignments.length;
    const formatLoggedWorkoutDistance = (log: DayLogEvent): string => formatDistanceMeters((log.distance_meters ?? 0) + (log.rest_distance_meters ?? 0));

    if (authLoading || templatesLoading || !hasLoadedEnrollment || (!hasLoadedLogs && loading)) {
        return (
            <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 lg:p-10 font-sans">
                <div className="max-w-6xl mx-auto space-y-4 animate-pulse">
                    <div className="h-10 w-64 bg-neutral-800 rounded-lg" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="h-32 rounded-xl bg-neutral-900" />
                        <div className="h-32 rounded-xl bg-neutral-900" />
                        <div className="h-32 rounded-xl bg-neutral-900" />
                    </div>
                    <div className="h-64 rounded-xl bg-neutral-900" />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-10 font-sans">
                <div className="max-w-3xl mx-auto">
                    <Card className="border-amber-500/30 bg-amber-900/10">
                        <CardHeader title="Sign in required" subtitle="Training Block needs your account to match logs to days." />
                        <p className="text-neutral-300 text-sm">
                            Please <Link to="/login" className="text-emerald-400 hover:text-emerald-300">log in</Link> to view your 12-week trainer view.
                        </p>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 lg:p-10 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Training block</p>
                            <Badge variant={trainingBlockEnrollment ? lifecycleBadgeVariant : 'warning'} dot={trainingBlockEnrollment ? lifecycleStatus === 'active' : false}>
                                {trainingBlockEnrollment ? lifecycleStatusLabel[lifecycleStatus] : 'Setup needed'}
                            </Badge>
                        </div>
                        <h1 className="text-3xl font-bold text-white">{selectedTemplate.name}</h1>
                        <p className="text-neutral-400 mt-2 max-w-3xl">
                            Integrated plan view that matches Concept2 and manual workout logs to planned work in the same training week.
                            {trainingBlockEnrollment && isTrainingBlockActive
                                ? ' Quick checks create lightweight logs for support work; manual entry is for fuller details or deliberate rowing backfill.'
                                : ' Setup and paused mode keep the plan visible but disable completion and review writes.'}
                        </p>
                        {isTeamContext && (
                            <p className="text-sm text-neutral-400 mt-3">
                                Viewing {selectedAthleteLabel}. Scope: {scopeTeamText}.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <div className="rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-300">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-medium text-white">{selectedTemplate.name}</span>
                                <span>{formatDateLabel(plan.start_date)} - {formatDateLabel(plan.end_date)}</span>
                                <Badge variant={trainingBlockEnrollment ? lifecycleBadgeVariant : 'warning'} size="sm">
                                    {trainingBlockEnrollment ? lifecycleStatusLabel[lifecycleStatus] : 'Not started'}
                                </Badge>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={openSetup}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white transition-colors"
                        >
                            <Settings size={16} />
                            Configure
                        </button>
                        <button
                            type="button"
                            onClick={() => updateTrainingBlockActive(!isTrainingBlockActive)}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                                trainingBlockEnrollment && isTrainingBlockActive
                                    ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200 hover:border-emerald-400/70'
                                    : 'border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white'
                            }`}
                            aria-pressed={Boolean(trainingBlockEnrollment && isTrainingBlockActive)}
                        >
                            <Power size={16} />
                            {trainingBlockEnrollment && isTrainingBlockActive ? 'Active plan' : 'Turn on'}
                        </button>
                        {isTeamContext && (
                            <label className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-300">
                                <Users size={16} />
                                <span className="sr-only">Athlete filter</span>
                                <select
                                    value={selectedAthleteUserId}
                                    onChange={(event) => setSelectedAthleteUserId(event.target.value)}
                                    disabled={athleteOptions.length === 0}
                                    className="bg-transparent border-none outline-none text-sm text-white"
                                    aria-label="Filter training block logs by athlete"
                                >
                                    <option value="team_all">All athletes</option>
                                    {athleteOptions.map((athlete) => (
                                        <option key={`${athlete.userId}-${athlete.teamName}`} value={athlete.userId}>
                                            {athlete.name} · {athlete.teamName}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <Link
                            to={teamHomePath}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:text-white hover:border-neutral-500 transition-colors"
                        >
                            <Calendar size={16} />
                            {pathname.startsWith('/team-management') ? 'Team Management' : 'Team dashboard'}
                        </Link>
                        <Link
                            to={teamSettingsPath}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:text-white hover:border-neutral-500 transition-colors"
                        >
                            <ListChecks size={16} />
                            Team settings
                        </Link>
                    </div>
                </div>

                {setupOpen && (
                    <Card variant="outlined" className="border-blue-500/30 bg-blue-950/10">
                        <form onSubmit={saveTrainingBlockSetup} className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-content-primary">Start a training block</p>
                                    <p className="text-sm text-neutral-400 mt-1">Choose a published template and start date. Duration is fixed by the template.</p>
                                </div>
                                {trainingBlockEnrollment && (
                                    <button
                                        type="button"
                                        onClick={() => setSetupOpen(false)}
                                        className="text-sm text-neutral-400 hover:text-white"
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                                <label className="text-xs text-neutral-400">
                                    Template
                                    <select
                                        value={setupTemplateKey}
                                        onChange={(event) => setSetupTemplateKey(event.target.value as TrainingBlockTemplateKey)}
                                        className={fieldClass}
                                    >
                                        {availableTemplates.map((template) => (
                                            <option key={template.template_key} value={template.template_key}>
                                                {template.name}
                                            </option>
                                        ))}
                                        {TRAINING_BLOCK_PLAN_OPTIONS.filter((option) => !option.enabled).map((option) => (
                                            <option key={option.id} value={option.id} disabled>
                                                {option.label} (coming later)
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="text-xs text-neutral-400">
                                    Start date
                                    <input
                                        type="date"
                                        value={setupStartDate}
                                        onChange={(event) => setSetupStartDate(event.target.value)}
                                        className={fieldClass}
                                        required
                                    />
                                </label>
                                <div className="rounded-lg border border-neutral-700 bg-neutral-950/50 px-3 py-2 text-xs text-neutral-400">
                                    <p className="uppercase tracking-wide text-neutral-500">Computed range</p>
                                    <p className="mt-1 text-sm font-medium text-white">{formatDateLabel(setupStartDate)} - {formatDateLabel(setupEndDate)}</p>
                                    <p className="mt-1">{setupTemplate.duration_weeks} weeks</p>
                                </div>
                            </div>
                            <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Setup action</p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => setSetupIntent('activate')}
                                        className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${setupIntent === 'activate'
                                            ? 'border-emerald-500 bg-emerald-500/10 text-white'
                                            : 'border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white'}`}
                                    >
                                        <span className="block font-medium">Activate now</span>
                                        <span className="mt-1 block text-xs text-neutral-400">Makes this your current block and pauses other active personal blocks.</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSetupIntent('schedule')}
                                        className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${setupIntent === 'schedule'
                                            ? 'border-blue-500 bg-blue-500/10 text-white'
                                            : 'border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white'}`}
                                    >
                                        <span className="block font-medium">Schedule for later</span>
                                        <span className="mt-1 block text-xs text-neutral-400">Saves a future block without changing your current active block.</span>
                                    </button>
                                </div>
                            </div>
                            {setupError && <p className="text-sm text-red-300">{setupError}</p>}
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSetupStartDate(getMondaySnappedDate())}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
                                >
                                    <CalendarDays size={16} />
                                    Snap to Monday
                                </button>
                                {nextBlockStartDate && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSetupIntent('schedule');
                                            setSetupStartDate(nextBlockStartDate);
                                        }}
                                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
                                    >
                                        <CalendarDays size={16} />
                                        After current block
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={setupSaving}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Power size={16} />
                                    {setupSaving ? (setupIntent === 'schedule' ? 'Scheduling...' : 'Starting...') : (setupIntent === 'schedule' ? 'Schedule block' : 'Start block')}
                                </button>
                            </div>
                        </form>
                    </Card>
                )}

                {!isTeamContext && (trainingBlockEnrollments.length > 0 || enrollmentsLoading || historyError) && (
                    <Card variant="outlined" className="border-neutral-800 bg-neutral-900/30">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-content-primary">Your training blocks</p>
                                <p className="text-sm text-neutral-400 mt-1">View, activate, or resume saved blocks without changing their original dates.</p>
                            </div>
                            {enrollmentsLoading && <p className="text-xs text-neutral-500">Loading...</p>}
                        </div>
                        {historyError && <p className="mt-3 text-sm text-red-300">{historyError}</p>}
                        {trainingBlockEnrollments.length > 0 && (
                            <div className="mt-4 divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
                                {trainingBlockEnrollments.map((enrollment) => {
                                    const enrollmentLifecycle = getEnrollmentLifecycleStatus(enrollment);
                                    const isCurrentEnrollment = trainingBlockEnrollment?.id === enrollment.id;
                                    const isResumeSaving = resumeEnrollmentId === enrollment.id;
                                    const isRemoving = removingEnrollmentId === enrollment.id;

                                    return (
                                        <div key={enrollment.id} className="flex flex-col gap-3 bg-neutral-950/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate text-sm font-medium text-white">{getTemplateName(enrollment.template_key)}</p>
                                                    <Badge variant={lifecycleStatusTone[enrollmentLifecycle]} size="sm" dot={enrollmentLifecycle === 'active'}>
                                                        {lifecycleStatusLabel[enrollmentLifecycle]}
                                                    </Badge>
                                                    {isCurrentEnrollment && <span className="text-xs text-neutral-500">Current view</span>}
                                                </div>
                                                <p className="mt-1 text-xs text-neutral-400">
                                                    {formatDateLabel(enrollment.start_date)} - {formatDateLabel(enrollment.end_date)}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {!isCurrentEnrollment && (
                                                    <button
                                                        type="button"
                                                        onClick={() => viewTrainingBlockEnrollment(enrollment)}
                                                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-500 hover:text-white"
                                                    >
                                                        <Eye size={14} />
                                                        View
                                                    </button>
                                                )}
                                                {!enrollment.is_active && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void resumeTrainingBlockEnrollment(enrollment)}
                                                        disabled={Boolean(resumeEnrollmentId) || Boolean(removingEnrollmentId)}
                                                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        <Power size={14} />
                                                        {isResumeSaving ? (enrollment.status === 'scheduled' ? 'Activating...' : 'Resuming...') : (enrollment.status === 'scheduled' ? 'Activate' : 'Resume')}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => void removeTrainingBlockEnrollment(enrollment)}
                                                    disabled={Boolean(resumeEnrollmentId) || Boolean(removingEnrollmentId)}
                                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-200 hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <Trash2 size={14} />
                                                    {isRemoving ? 'Removing...' : 'Remove'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                )}

                {trainingBlockEnrollment && !isTrainingBlockActive && (
                    <Card variant="outlined" className="border-neutral-700 bg-neutral-900/40">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-content-primary">{trainingBlockEnrollment.status === 'scheduled' ? 'Scheduled plan' : 'Paused plan'}</p>
                                <p className="text-sm text-neutral-400 mt-1">
                                    {trainingBlockEnrollment.status === 'scheduled'
                                        ? 'This block is scheduled for later. It remains visible for planning, but quick checks, manual completions, and review overrides are disabled until it is active.'
                                        : 'The block remains visible for planning, but quick checks, manual completions, and review overrides are disabled until it is active.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => updateTrainingBlockActive(true)}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
                            >
                                <Power size={16} />
                                {trainingBlockEnrollment.status === 'scheduled' ? 'Activate now' : 'Activate block'}
                            </button>
                        </div>
                    </Card>
                )}

                {!isTeamContext && (
                    <Card variant="outlined" className="border-neutral-800 bg-neutral-900/30">
                        <details>
                            <summary className="cursor-pointer list-none">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-content-primary">Template details</p>
                                        <p className="text-xs text-content-muted mt-1">
                                            {templateHealth.source === 'database' ? 'Database template' : 'Static fallback'} · {templateHealth.total_sessions} sessions · {templateHealth.library_linked_sessions} library-linked · {templateHealth.block_local_sessions} block-local{linkedWorkoutTemplatesLoading ? ' · loading library links' : ''}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={templateHealth.error_count > 0 ? 'danger' : 'success'} dot={templateHealth.error_count > 0}>
                                            {templateHealth.error_count} errors
                                        </Badge>
                                        <Badge variant={templateHealth.warning_count > 0 ? 'warning' : 'muted'} dot={templateHealth.warning_count > 0}>
                                            {templateHealth.warning_count} warnings
                                        </Badge>
                                    </div>
                                </div>
                            </summary>
                            <div className="mt-4 border-t border-neutral-800 pt-4 space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
                                        <p className="text-neutral-500">Days</p>
                                        <p className="text-neutral-200 mt-1">{templateHealth.total_days}/{templateHealth.expected_days}</p>
                                    </div>
                                    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
                                        <p className="text-neutral-500">RWN sessions</p>
                                        <p className="text-neutral-200 mt-1">{templateHealth.rwn_session_count}</p>
                                    </div>
                                    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
                                        <p className="text-neutral-500">Support prescriptions</p>
                                        <p className="text-neutral-200 mt-1">{templateHealth.support_session_count}</p>
                                    </div>
                                    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
                                        <p className="text-neutral-500">Empty days</p>
                                        <p className="text-neutral-200 mt-1">{templateHealth.empty_day_count}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
                                        <p className="text-neutral-500">Library RWN</p>
                                        <p className="text-neutral-200 mt-1">{templateHealth.linked_sessions_with_library_rwn}/{templateHealth.library_linked_sessions}</p>
                                    </div>
                                    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
                                        <p className="text-neutral-500">Block RWN on linked</p>
                                        <p className="text-neutral-200 mt-1">{templateHealth.linked_sessions_with_block_rwn}</p>
                                    </div>
                                    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
                                        <p className="text-neutral-500">Library-only RWN</p>
                                        <p className="text-neutral-200 mt-1">{templateHealth.linked_sessions_using_library_rwn}</p>
                                    </div>
                                    <div className="rounded border border-neutral-800 bg-neutral-950/50 p-2">
                                        <p className="text-neutral-500">RWN mismatches</p>
                                        <p className="text-neutral-200 mt-1">{templateHealth.linked_sessions_with_rwn_mismatch}</p>
                                    </div>
                                </div>
                                {templateHealth.issues.length === 0 ? (
                                    <p className="text-xs text-neutral-500">No template validation issues found.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {templateHealth.issues.slice(0, 6).map((issue, index) => (
                                            <div key={`${issue.code}-${issue.session_id ?? 'day'}-${index}`} className={`rounded border px-3 py-2 text-xs ${templateHealthIssueTone[issue.severity]}`}>
                                                <p className="font-medium">{issue.code}</p>
                                                <p className="mt-0.5 opacity-90">{issue.message}</p>
                                                {(issue.week_number || issue.day_slot !== undefined || issue.session_id) && (
                                                    <p className="mt-1 opacity-70">
                                                        {issue.week_number ? `Week ${issue.week_number}` : ''}{issue.day_slot !== undefined ? ` · Day ${issue.day_slot + 1}` : ''}{issue.session_id ? ` · ${issue.session_id}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                        {templateHealth.issues.length > 6 && (
                                            <p className="text-xs text-neutral-500">{templateHealth.issues.length - 6} more issues not shown.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </details>
                    </Card>
                )}

                {isTeamContext && (
                    <Card>
                        <CardHeader
                            title="Team weekly snapshot"
                            subtitle={`Week ${selectedScopeWeek} compliance at a glance`}
                        />
                        <div className="grid gap-2">
                                {teamAthleteScopeSummary.map((athleteSummary) => (
                                    <button
                                    key={athleteSummary.athleteUserId}
                                    type="button"
                                    onClick={() => setSelectedAthleteUserId(athleteSummary.athleteUserId)}
                                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                                        athleteSummary.athleteUserId === selectedAthleteUserId
                                            ? 'border-emerald-500/60 bg-emerald-900/10'
                                            : 'border-neutral-800 hover:border-neutral-700'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-medium text-content-primary">
                                                {athleteSummary.athleteName}
                                            </p>
                                            <p className="text-xs text-content-muted mt-1">
                                                {athleteSummary.teamName}
                                            </p>
                                        </div>
                                        <div className="text-xs text-right text-neutral-300">
                                            <p>{athleteSummary.weekCoverage}%</p>
                                            <p className="text-neutral-500">
                                                {formatDistanceMeters(athleteSummary.actualDistance)} / {formatDistanceMeters(athleteSummary.targetDistance)}
                                            </p>
                                            <p className="text-content-muted mt-1">
                                                Slot coverage: {athleteSummary.coveredSlots}/7
                                            </p>
                                            <p className="text-content-muted mt-1">
                                                Key sessions: {athleteSummary.keySessionCreditText}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </Card>
                )}

                {isTeamContext && (
                    <Card>
                        <CardHeader
                            title="Team assigned workouts"
                            subtitle={`Week ${selectedScopeWeek} coaching prescriptions (team planning) · ${selectedWeekAssignmentCount} total`}
                        />
                        {assignmentsLoading ? (
                            <p className="text-sm text-neutral-400">Loading team assignments...</p>
                        ) : (
                            <div className="space-y-2">
                                {selectedWeekAssignments.length === 0 ? (
                                    <p className="text-sm text-neutral-500">
                                        No team-assigned workouts were found for this week.
                                    </p>
                                ) : (
                                    selectedWeekAssignments.map((assignment) => {
                                        const weekMatch = selectedWeekAssignmentMatches.get(assignment.id);
                                        const relationshipTone = weekMatch ? assignmentRelationshipTone[weekMatch.match.relationship] : assignmentRelationshipTone.unmatched;

                                        return (
                                        <div
                                            key={assignment.id}
                                            className={`rounded-lg border px-3 py-2.5 ${
                                                assignment.scheduled_date === selectedDay.date
                                                    ? 'border-emerald-500/60 bg-emerald-900/10'
                                                    : 'border-neutral-800'
                                            }`}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-sm text-white">
                                                    {assignment.canonical_name ?? assignment.title ?? 'Unnamed assignment'}
                                                </p>
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    <Badge variant={relationshipTone.variant} dot={relationshipTone.dot}>
                                                        {relationshipTone.label}
                                                    </Badge>
                                                    <Badge variant="info" dot>
                                                        {assignment.scheduled_date}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <p className="text-xs text-content-muted mt-1">
                                                {assignment.teamName} · {assignment.assignmentScope}
                                            </p>
                                            {weekMatch?.match.planned_session_title && (
                                                <p className="text-xs text-content-secondary mt-1">
                                                    Week match: {weekMatch.match.planned_session_title} · {weekMatch.planned_day.day_of_week} {formatWeekday(weekMatch.planned_day.date)}
                                                </p>
                                            )}
                                            {assignment.instructions && (
                                                <p className="text-xs text-content-secondary mt-1">Instructions: {assignment.instructions}</p>
                                            )}
                                            {isCoach && (
                                                <Link
                                                    to={`/team-management/assignments/${assignment.id}/results`}
                                                    className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 inline-block"
                                                >
                                                    View assignment results →
                                                </Link>
                                            )}
                                        </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                        {assignmentsError && (
                            <p className="mt-2 text-xs text-red-300 flex items-start gap-2">
                                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                {assignmentsError}
                            </p>
                        )}
                    </Card>
                )}

                {error && (
                    <Card variant="outlined" className="border-red-500/40 bg-red-900/10">
                        <CardHeader title="Load error" />
                        <p className="text-sm text-red-300 flex items-start gap-2">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            {error}
                        </p>
                    </Card>
                )}

                <Card>
                    <CardHeader
                        title={`Week ${selectedWeekSummary?.week_number ?? 1} summary`}
                        subtitle={isTeamContext
                            ? `${scopeTeamText} · ${selectedAthleteLabel}`
                            : `${formatWeekday(selectedWeekStart)} - ${formatWeekday(selectedWeekEnd)} · same-week matching`}
                        action={
                            <Badge variant={statusTone[selectedDaySummary.status].variant} dot>
                                {selectedDay.day_of_week} · {statusLabel[selectedDaySummary.status]}
                            </Badge>
                        }
                    />
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                        <div className="rounded-lg border border-border bg-surface-secondary p-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-content-muted">Target</p>
                            <p className="mt-1 text-xl font-semibold text-content-primary">
                                {selectedWeekSummary ? formatDistanceMeters(selectedWeekSummary.target_distance_meters) : '-'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-content-muted">Plan {selectedWeekSummary ? formatDistanceMeters(selectedWeekSummary.planned_distance_meters) : '-'}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-secondary p-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-content-muted">Meters logged</p>
                            <p className="mt-1 text-xl font-semibold text-content-primary">
                                {selectedWeekSummary ? formatDistanceMeters(selectedWeekSummary.actual_distance_meters) : '-'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-content-muted">{selectedWeekSummary ? `${formatSignedDistanceMeters(selectedWeekSummary.delta_to_target_meters)} vs target` : '-'}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-secondary p-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-content-muted">Plan-counted sessions</p>
                            <p className="mt-1 text-xl font-semibold text-content-primary">
                                {selectedWeekSummary?.logged_session_count ?? 0}/{selectedWeekSummary?.planned_session_count ?? 0}
                            </p>
                            <p className="mt-0.5 text-[11px] text-content-muted">Matched logs / planned</p>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-secondary p-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-content-muted">Days logged</p>
                            <p className="mt-1 text-xl font-semibold text-content-primary">
                                {selectedWeekSummary?.completed_day_count ?? 0}/7
                            </p>
                            <p className="mt-0.5 text-[11px] text-content-muted">Plan-counted days</p>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-secondary p-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-content-muted">Key sessions</p>
                            <p className="mt-1 text-xl font-semibold text-content-primary">
                                {selectedWeekSummary?.key_session_credits.earned ?? 0}/{selectedWeekSummary?.key_session_credits.possible ?? 0}
                            </p>
                            <p className="mt-0.5 text-[11px] text-content-muted">{selectedWeekSummary?.key_session_credits.partial ?? 0} partial</p>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-secondary p-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-content-muted">Load</p>
                            <p className="mt-1 text-xl font-semibold text-content-primary">{selectedWeekLoad.toFixed(1)}</p>
                            <p className="mt-0.5 text-[11px] text-content-muted">Distance x RPE</p>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
                        <div className="space-y-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                                <div className="h-2 rounded-full bg-surface-secondary lg:flex-1 overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all"
                                        style={{ width: `${weekCoverage}%` }}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {planLogSummaries.map((weekSummary) => {
                                        const firstDay = plan.days.find((day) => day.week_number === weekSummary.week_number);
                                        const isSelected = weekSummary.week_number === selectedWeekSummary?.week_number;
                                        const coverage = Math.min(100, Math.round(weekSummary.target_coverage_ratio * 100));

                                        return (
                                            <button
                                                key={weekSummary.week_number}
                                                type="button"
                                                onClick={() => {
                                                    if (firstDay) setSelectedDate(firstDay.date);
                                                }}
                                                className={`h-8 min-w-10 rounded-md border px-2 text-xs font-medium transition-colors ${
                                                    isSelected
                                                        ? 'border-emerald-500/70 bg-emerald-500/15 text-content-primary'
                                                        : 'border-border bg-surface-card text-content-muted hover:border-emerald-500/40 hover:text-content-primary'
                                                }`}
                                                title={`Week ${weekSummary.week_number}: ${coverage}% coverage`}
                                            >
                                                W{weekSummary.week_number}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                                {selectedWeekDays.map((day) => {
                                    const daySummary = daySummariesByDate.get(day.date) ?? summarizeDayProgress(day, [], templateMatchingContext);
                                    const isSelected = day.date === selectedDay.date;
                                    const style = statusTone[daySummary.status];
                                    const dailyLogCount = calendarLogCountByDate.get(day.date) ?? 0;
                                    const dayAssignments = assignmentsByDate.get(day.date) ?? [];
                                    return (
                                        <button
                                            key={day.date}
                                            type="button"
                                            onClick={() => setSelectedDate(day.date)}
                                            className={`min-h-16 rounded-lg border p-2 text-left transition-colors ${
                                                isSelected
                                                    ? 'border-emerald-500/70 bg-emerald-500/10'
                                                    : 'border-border bg-surface-card hover:border-emerald-500/40 hover:bg-surface-secondary'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                                                        {day.day_of_week.slice(0, 3)}
                                                    </p>
                                                    <p className="mt-0.5 text-sm font-medium text-content-primary">
                                                        {formatWeekday(day.date)}
                                                    </p>
                                                </div>
                                                <Badge variant={style.variant} size="sm" dot={style.dot}>
                                                    {dailyLogCount}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-content-muted">
                                                {formatDistanceMeters(day.planned_distance_meters)} planned
                                            </p>
                                            {dayAssignments.length > 0 && (
                                                <p className="mt-0.5 text-[11px] text-content-secondary">
                                                    {dayAssignments.length} team prescription{dayAssignments.length === 1 ? '' : 's'}
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-lg border border-border bg-surface-card p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs uppercase tracking-wide text-content-muted">Selected day</p>
                                <Badge variant={statusTone[selectedDaySummary.status].variant} size="sm" dot={statusTone[selectedDaySummary.status].dot}>
                                    {statusLabel[selectedDaySummary.status]}
                                </Badge>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-content-primary">
                                {selectedDay.day_of_week} · {formatWeekday(selectedDay.date)}
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <p className="text-[11px] text-content-muted">Planned</p>
                                    <p className="font-semibold text-content-primary">{formatDistanceMeters(selectedDay.planned_distance_meters)}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-content-muted">Plan-counted</p>
                                    <p className="font-semibold text-content-primary">{formatDistanceMeters(dayActualDistance)}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-content-muted">Calendar logs</p>
                                    <p className="font-semibold text-content-primary">{selectedDayCalendarLogs.length}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-content-muted">Key</p>
                                    <p className="font-semibold text-content-primary">{selectedDaySummary.key_session_credit}</p>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-content-muted">
                                <span><Flame size={12} className="inline-block mr-1 text-amber-400" />{dayLoad.toFixed(1)} load</span>
                                <span>{selectedDayCalendarLogs.length} log{selectedDayCalendarLogs.length === 1 ? '' : 's'} today</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Plan & matching"
                        subtitle={`${selectedDay.day_of_week} · ${formatWeekday(selectedDay.date)} · workouts completed this week can count toward the matching planned session`}
                        action={
                            <Badge variant={statusTone[selectedDaySummary.status].variant} dot>
                                {statusLabel[selectedDaySummary.status]}
                            </Badge>
                        }
                    />
                        <div className={`grid grid-cols-1 gap-4 ${selectedDayLoggedWorkoutEntries.length === 0 && !manualEntryOpen ? 'lg:grid-cols-[minmax(0,1fr)_16rem]' : 'lg:grid-cols-[minmax(0,1fr)_22rem]'}`}>
                            {selectedDayAssignments.length > 0 && (
                                <section className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 lg:col-span-2">
                                    <h3 className="text-sm font-semibold text-content-primary mb-3 flex items-center gap-2">
                                        <Users size={16} className="text-indigo-400" />
                                        Team prescriptions for this date
                                    </h3>
                                    <div className="space-y-2">
                                        {selectedDayAssignments.map((assignment) => {
                                            const weekMatch = selectedWeekAssignmentMatches.get(assignment.id);
                                            const assignmentMatch = weekMatch?.match ?? scoreAssignmentAgainstPlanDay(selectedDay, assignment, templateMatchingContext);
                                            const relationshipTone = assignmentRelationshipTone[assignmentMatch.relationship];

                                            return (
                                                <div
                                                    key={assignment.id}
                                                    className="rounded-lg border border-neutral-800 px-3 py-2.5 text-sm"
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <p className="text-content-primary">{assignment.canonical_name ?? assignment.title ?? 'Unnamed assignment'}</p>
                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            <Badge variant={relationshipTone.variant} dot={relationshipTone.dot}>
                                                                {relationshipTone.label}
                                                            </Badge>
                                                            <span className="text-xs text-content-muted">
                                                                {assignment.teamName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {assignmentMatch.planned_session_title && (
                                                        <p className="text-xs text-content-secondary mt-1">
                                                            Plan match: {assignmentMatch.planned_session_title}
                                                            {weekMatch && weekMatch.planned_day.date !== assignment.scheduled_date
                                                                ? ` · ${weekMatch.planned_day.day_of_week} ${formatWeekday(weekMatch.planned_day.date)}`
                                                                : ''}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-content-muted mt-1">
                                                        {assignmentMatch.reason}
                                                    </p>
                                                    {assignment.instructions && (
                                                        <p className="text-xs text-content-muted mt-1">
                                                            Instructions: {assignment.instructions}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            <section className="rounded-xl border border-border bg-surface-card p-4">
                                <h3 className="text-sm font-semibold text-content-primary mb-3 flex items-center gap-2">
                                    <Target size={16} className="text-emerald-400" />
                                    Planned intent
                                </h3>
                                <p className="text-xs text-content-muted mb-3">
                                    Planned distance this day: {formatDistanceMeters(selectedDay.planned_distance_meters)}
                                </p>
                                <div className="space-y-3">
                                    {selectedDay.sessions.map((session) => (
                                        (() => {
                                            const routine = resolveRoutineForSession(selectedReference, session.title, session.source);

                                            return (
                                                <div
                                                    key={session.id}
                                                    className={reviewSurfaceClass}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <p className="font-medium text-content-primary">{session.title}</p>
                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            {(session.source === 'strength') && (() => {
                                                                const supportStatus = getSupportCompletionStatus(session.id);
                                                                const completionTone = supportStatus ? supportCompletionTone[supportStatus] : null;
                                                                const saving = quickCompletionSavingKey === session.id;

                                                                return (
                                                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                                        {completionTone && (
                                                                            <Badge variant={completionTone.variant} size="sm" dot={supportStatus !== 'skipped'}>
                                                                                {completionTone.label}
                                                                            </Badge>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            disabled={saving || !canCreateManualEntry}
                                                                            onClick={() => void saveSupportCompletion({
                                                                                plannedSessionKey: session.id,
                                                                                supportSessionTemplateId: session.support_session_template_id ?? null,
                                                                                status: 'completed',
                                                                            })}
                                                                            className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-content-primary hover:border-emerald-400/60 hover:text-emerald-600 dark:hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                                        >
                                                                            Done
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={saving || !canCreateManualEntry}
                                                                            onClick={() => openSupportCompletionEditor(session, supportStatus ?? 'modified')}
                                                                            className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-content-primary hover:border-blue-400/60 hover:text-blue-600 dark:hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                                        >
                                                                            Details
                                                                        </button>
                                                                        {supportStatus && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={saving || !canCreateManualEntry}
                                                                                onClick={() => void removeSupportCompletion(session.id)}
                                                                                className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-content-primary hover:border-red-400/60 hover:text-red-600 dark:hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                                            >
                                                                                Clear
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            {session.workout_template_id && (
                                                                <Badge variant="info">Library</Badge>
                                                            )}
                                                            <Badge variant={session.is_key_session ? 'coaching' : 'muted'}>
                                                                {sourceLabel[session.source]}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    {session.planned_rwn && (
                                                        <p className="text-xs text-emerald-300 mt-1">
                                                            RWN: {session.planned_rwn}
                                                        </p>
                                                    )}
                                                    <p className="text-content-muted mt-1">
                                                        {session.expected_distance_meters ? `${formatDistanceMeters(session.expected_distance_meters)} planned` : 'Duration/effort focused'}
                                                        {session.target_split_seconds_per_500m ? ` · target ${formatSplit(session.target_split_seconds_per_500m)}/500m` : ''}
                                                    </p>
                                                    {(matchedLogsBySessionId.get(session.id) ?? []).length > 0 && (
                                                        <div className={matchedCompletionClass}>
                                                            {(matchedLogsBySessionId.get(session.id) ?? []).map(({ log, match }) => {
                                                                const canEditMatchedLog = !isTeamContext && log.source === 'manual' && log.user_id === user?.id && !isTrainingBlockQuickLog(log);
                                                                const canRemoveMatchedLog = !isTeamContext && log.source === 'manual' && log.user_id === user?.id;

                                                                return (
                                                                    <div key={log.workout_id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-content-primary">
                                                                                Completed: {log.workout_name ?? 'Workout'}
                                                                            </p>
                                                                            <p className="text-[11px] text-content-secondary">
                                                                                {formatLoggedWorkoutDistance(log)} · {formatDuration(log.duration_seconds)}{log.avg_split_500m ? ` · ${formatSplit(log.avg_split_500m)}/500m` : ''}
                                                                            </p>
                                                                            <p className="text-[11px] text-content-muted mt-0.5">
                                                                                {log.rawDateLabel !== selectedDay.date ? `Completed ${log.rawDateLabel}; counted toward ${formatPlanSlot(selectedDay.day_slot)} (${formatWeekday(selectedDay.date)}). ` : ''}{match.reason}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
                                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-300" />
                                                                                {assignmentRelationshipTone[match.relationship].label}
                                                                            </span>
                                                                            <label className="inline-flex items-center gap-1 text-[11px] text-content-muted">
                                                                                Match
                                                                                <select
                                                                                    value={getReviewAssignmentValue(log)}
                                                                                    disabled={!isTrainingBlockActive}
                                                                                    onChange={(event) => applyReviewAssignmentValue(log, event.target.value)}
                                                                                    className="rounded-md border border-border bg-surface-card px-2 py-0.5 text-[11px] text-content-primary disabled:opacity-60"
                                                                                >
                                                                                    <option value={AUTO_OVERRIDE_VALUE}>Auto</option>
                                                                                    <option value={DOES_NOT_COUNT_VALUE}>Does not count</option>
                                                                                    {selectedWeekSessionOptions.map(({ day, session }) => (
                                                                                        <option key={`${day.week_number}-${day.day_slot}-${session.id}`} value={`${day.day_slot}|${session.id}`}>
                                                                                            {formatPlanSlot(day.day_slot)} · {session.title}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            </label>
                                                                            {canEditMatchedLog && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openManualLogEdit(log)}
                                                                                    className="rounded-md border border-border bg-surface-card px-2 py-0.5 text-[11px] font-medium text-content-primary hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                                                                                >
                                                                                    Edit
                                                                                </button>
                                                                            )}
                                                                            {canRemoveMatchedLog && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => void removeManualWorkoutLog(log)}
                                                                                    className="rounded-md border border-border bg-surface-card px-2 py-0.5 text-[11px] font-medium text-content-primary hover:border-red-400 hover:text-red-600 dark:hover:text-red-200"
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {session.instructions && session.instructions.length > 0 && (
                                                        <ul className="mt-2 text-xs text-content-secondary list-disc list-inside">
                                                            {session.instructions.map((instruction) => (
                                                                <li key={instruction}>{instruction}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    {routine && routine.exercises && routine.exercises.length > 0 && (
                                                        <div className="mt-3 border-t border-border pt-3">
                                                            <p className="text-xs uppercase tracking-wide text-content-muted mb-2">
                                                                {routine.kind} routine
                                                            </p>
                                                            <p className="text-[11px] text-content-muted mb-2">
                                                                Focus: {routine.focus.join(', ')}
                                                            </p>
                                                            <ul className="space-y-1 text-xs text-content-secondary list-disc list-inside">
                                                                {routine.exercises.map((exercise) => (
                                                                    <li key={`${exercise.name}-${exercise.sets}-${exercise.reps}`}>
                                                                        <span className="text-content-primary">{exercise.name}</span>
                                                                        {' '}
                                                                        {formatExerciseSetNotation(exercise.sets, exercise.reps)}
                                                                        {exercise.notes ? ` · ${exercise.notes}` : ''}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            {routine.notes && routine.notes.length > 0 && (
                                                                <div className="mt-2">
                                                                    <p className="text-[11px] text-content-muted">Coach notes</p>
                                                                    <ul className="text-xs list-disc list-inside text-content-secondary mt-1">
                                                                        {routine.notes.map((note) => (
                                                                            <li key={note}>{note}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    ))}
                                </div>
                                {selectedReference && (
                                    <div className="mt-4 pt-3 border-t border-border">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                            <p className="text-xs uppercase tracking-wide text-content-muted">Support prep</p>
                                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                {(() => {
                                                    const supportPrepStatus = getSupportCompletionStatus('support-prep');
                                                    const completionTone = supportPrepStatus ? supportCompletionTone[supportPrepStatus] : null;
                                                    return completionTone ? (
                                                        <Badge variant={completionTone.variant} size="sm" dot={supportPrepStatus !== 'skipped'}>
                                                            {completionTone.label}
                                                        </Badge>
                                                    ) : null;
                                                })()}
                                                <button
                                                    type="button"
                                                    disabled={quickCompletionSavingKey === 'support-prep' || !canCreateManualEntry}
                                                    onClick={() => void saveSupportCompletion({
                                                        plannedSessionKey: 'support-prep',
                                                        supportSessionTemplateId: null,
                                                        status: 'completed',
                                                    })}
                                                    className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-content-primary hover:border-emerald-400/60 hover:text-emerald-600 dark:hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Done
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={quickCompletionSavingKey === 'support-prep' || !canCreateManualEntry}
                                                    onClick={() => void saveSupportCompletion({
                                                        plannedSessionKey: 'support-prep',
                                                        supportSessionTemplateId: null,
                                                        status: 'skipped',
                                                    })}
                                                    className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-content-primary hover:border-amber-400/60 hover:text-amber-600 dark:hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Skip
                                                </button>
                                                {isSupportPrepComplete && (
                                                    <button
                                                        type="button"
                                                        disabled={quickCompletionSavingKey === 'support-prep' || !canCreateManualEntry}
                                                        onClick={() => void removeSupportCompletion('support-prep')}
                                                        className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-content-primary hover:border-red-400/60 hover:text-red-600 dark:hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {formatReferenceList(selectedReference.warmup, 'Warm-up')}
                                            {formatReferenceList(selectedReference.core, 'Core')}
                                            {formatReferenceList(selectedReference.stretching, 'Stretching')}
                                        </div>
                                        {supportPrepLogMatches.length > 0 && (
                                            <div className={matchedCompletionClass}>
                                                {supportPrepLogMatches.map(({ log }) => (
                                                    <p key={log.workout_id} className="text-xs font-semibold text-content-primary">
                                                        Completed: {formatDuration(log.duration_seconds)} support prep
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {selectedReference && (selectedReference.routines?.length ?? 0) === 0 && selectedDay.sessions.every((session) => session.source !== 'strength') && (
                                    <p className="mt-4 text-[11px] text-content-muted">
                                        This day has support prep and no scheduled strength slot.
                                    </p>
                                )}
                            </section>

                            <section className="self-start rounded-xl border border-border bg-surface-card p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <h3 className="text-sm font-semibold text-content-primary flex items-center gap-2">
                                        <CalendarDays size={16} className="text-blue-400" />
                                        Logged workouts ({selectedDayLoggedWorkoutEntries.length})
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={openManualEntry}
                                        disabled={!canCreateManualEntry}
                                        className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 py-2 text-xs font-medium text-content-primary hover:border-blue-400/70 disabled:cursor-not-allowed disabled:opacity-50"
                                        title={isTrainingBlockActive ? (canCreateManualEntry ? 'Add a manual completion' : 'Manual entries can only be created for your own account') : 'Activate the training block to add completions'}
                                    >
                                        <Plus size={13} />
                                        Add manual
                                    </button>
                                </div>
                                {manualEntryOpen && (
                                    <form onSubmit={saveManualEntry} className="mb-4 space-y-3 rounded-lg border border-blue-500/35 bg-blue-500/10 p-3">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-medium text-content-primary">{editingManualLogId ? 'Edit manual workout log' : 'Add a manual workout log'}</p>
                                                <p className="text-xs text-content-muted mt-1">Use quick checks for simple support completion. Use this form when you want a fuller manual log; Concept2 sync remains preferred for rowing.</p>
                                            </div>
                                            <button type="button" onClick={closeManualEntry} className="text-xs text-content-muted hover:text-content-primary">
                                                Cancel
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <label className="text-xs text-content-muted">
                                                Planned session
                                                <select
                                                    value={manualEntryForm.plannedSessionId}
                                                    onChange={(event) => updateManualEntrySession(event.target.value)}
                                                    className={manualFieldClass}
                                                >
                                                    <option value="">Custom manual log</option>
                                                    {selectedDay.sessions.map((session) => (
                                                        <option key={session.id} value={session.id}>{session.title}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="text-xs text-content-muted">
                                                Type
                                                <select
                                                    value={manualEntryForm.mode}
                                                    onChange={(event) => updateManualEntryMode(event.target.value as ManualWorkoutLogMode)}
                                                    className={manualFieldClass}
                                                >
                                                    {manualModeOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            {manualEntryUsesRWN && (
                                                <label className="text-xs text-content-muted">
                                                    RWN / modality
                                                    <input
                                                        value={manualEntryForm.manualRWN}
                                                        onChange={(event) => updateManualEntryForm('manualRWN', event.target.value)}
                                                        placeholder={manualEntryForm.mode === 'row' ? '8x500m/3:30r' : 'Cross: 60:00'}
                                                        className={manualFieldClass}
                                                    />
                                                </label>
                                            )}
                                            <label className="text-xs text-content-muted">
                                                Date
                                                <input
                                                    type="date"
                                                    value={manualEntryForm.completedDate}
                                                    onChange={(event) => updateManualEntryForm('completedDate', event.target.value)}
                                                    className={manualFieldClass}
                                                />
                                            </label>
                                            <label className="text-xs text-content-muted">
                                                Time
                                                <input
                                                    type="time"
                                                    value={manualEntryForm.completedTime}
                                                    onChange={(event) => updateManualEntryForm('completedTime', event.target.value)}
                                                    className={manualFieldClass}
                                                />
                                            </label>
                                            {manualEntryUsesDistance && (
                                                <label className="text-xs text-content-muted">
                                                    Meters
                                                    <input
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={manualEntryForm.distanceMetersInput}
                                                        onChange={(event) => updateManualEntryForm('distanceMetersInput', event.target.value)}
                                                        placeholder="8000"
                                                        className={manualFieldClass}
                                                    />
                                                </label>
                                            )}
                                            {manualEntryForm.mode === 'row' && (
                                                <label className="text-xs text-content-muted">
                                                    Average split /500m
                                                    <input
                                                        inputMode="decimal"
                                                        value={manualEntryForm.avgSplit}
                                                        onChange={(event) => updateManualEntryForm('avgSplit', event.target.value)}
                                                        placeholder="2:05.0"
                                                        className={manualFieldClass}
                                                    />
                                                </label>
                                            )}
                                            <label className="text-xs text-content-muted">
                                                Duration min
                                                <input
                                                    inputMode="decimal"
                                                    value={manualEntryForm.durationMinutes}
                                                    onChange={(event) => updateManualEntryForm('durationMinutes', event.target.value)}
                                                    placeholder="60"
                                                    className={manualFieldClass}
                                                />
                                            </label>
                                            <label className="text-xs text-content-muted">
                                                RPE
                                                <input
                                                    inputMode="numeric"
                                                    value={manualEntryForm.perceivedExertion}
                                                    onChange={(event) => updateManualEntryForm('perceivedExertion', event.target.value)}
                                                    placeholder="1-10"
                                                    className={manualFieldClass}
                                                />
                                            </label>
                                            <label className="text-xs text-content-muted sm:col-span-2">
                                                Notes
                                                <textarea
                                                    value={manualEntryForm.notes}
                                                    onChange={(event) => updateManualEntryForm('notes', event.target.value)}
                                                    rows={2}
                                                    className={manualFieldClass}
                                                />
                                            </label>
                                        </div>
                                        {manualEntryForm.mode === 'row' && (
                                            <label className="flex items-start gap-2 text-xs text-amber-200">
                                                <input
                                                    type="checkbox"
                                                    checked={manualEntryForm.rowingOptIn}
                                                    onChange={(event) => updateManualEntryForm('rowingOptIn', event.target.checked)}
                                                    className="mt-0.5"
                                                />
                                                <span>Use manual rowing entry for this workout. Concept2 sync remains the preferred row-workout path.</span>
                                            </label>
                                        )}
                                        {manualEntryError && (
                                            <p className="text-xs text-red-300 flex items-start gap-2">
                                                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                                {manualEntryError}
                                            </p>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={manualEntrySaving}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-400 disabled:opacity-60"
                                        >
                                            <CheckCircle2 size={14} />
                                            {manualEntrySaving ? 'Saving...' : editingManualLogId ? 'Save changes' : 'Save manual log'}
                                        </button>
                                    </form>
                                )}
                                {selectedDayLoggedWorkoutEntries.length === 0 ? (
                                    <p className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-content-secondary">No workouts logged for this day yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedDayLoggedWorkoutEntries.map(({ log, match: logMatch }) => {
                                            const tone = sourceTone[log.source];
                                            const relationshipTone = assignmentRelationshipTone[logMatch.relationship];
                                            const isQuickLog = isTrainingBlockQuickLog(log);
                                            const canRemoveManualLog = !isTeamContext && log.source === 'manual' && log.user_id === user?.id;
                                            const reviewAssignmentValue = getReviewAssignmentValue(log);

                                            return (
                                                <div
                                                    key={log.workout_id}
                                                    className={reviewSurfaceClass}
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <p className="font-medium text-content-primary">{log.workout_name}</p>
                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            <Badge variant={relationshipTone.variant} dot={relationshipTone.dot}>
                                                                {relationshipTone.label}
                                                            </Badge>
                                                            {log.source === 'manual' && (
                                                                <Badge variant={isQuickLog ? 'info' : 'muted'}>
                                                                    {isQuickLog ? 'Quick log' : 'Manual log'}
                                                                </Badge>
                                                            )}
                                                            <span className={`px-2 py-0.5 rounded-full text-xs ${tone.text} ${tone.bg}`}>
                                                                {tone.label}
                                                            </span>
                                                            {canRemoveManualLog && !isQuickLog && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openManualLogEdit(log)}
                                                                    disabled={quickCompletionSavingKey === log.workout_id}
                                                                    className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs text-content-primary hover:border-blue-400/60 hover:text-blue-600 dark:hover:text-blue-200 disabled:opacity-50"
                                                                    title="Edit this manual workout log"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                            {canRemoveManualLog && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void removeManualWorkoutLog(log)}
                                                                    disabled={quickCompletionSavingKey === log.workout_id}
                                                                    className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-xs text-content-primary hover:border-red-400/60 hover:text-red-600 dark:hover:text-red-200 disabled:opacity-50"
                                                                    title="Remove this manual workout log"
                                                                >
                                                                    <Trash2 size={12} />
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-content-secondary mt-1">
                                                        {log.workout_type} · {formatLoggedWorkoutDistance(log)} · RPE {log.perceived_exertion ?? '-'}
                                                    </p>
                                                    {isTeamContext && (
                                                        <p className="text-content-muted text-xs mt-1">
                                                            Athlete: {log.athlete_name ?? 'Unknown athlete'}
                                                        </p>
                                                    )}
                                                    <p className="text-content-muted text-xs mt-1">
                                                        Completed {log.rawDateLabel}{log.rawDateLabel !== selectedDay.date ? ` · matched ${formatPlanSlot(selectedDay.day_slot)} (${formatWeekday(selectedDay.date)})` : ''}
                                                    </p>
                                                    <p className="text-content-muted text-xs mt-1">
                                                        {formatDuration(log.duration_seconds)}{log.avg_split_500m ? ` · ${formatSplit(log.avg_split_500m)}/500m` : ''} · {isQuickLog ? 'Quick completion' : log.notes ? 'With notes' : 'No notes'}
                                                    </p>
                                                    {logMatch.planned_session_title && (
                                                        <p className="text-xs text-content-secondary mt-2">
                                                            Plan match: {logMatch.planned_session_title}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-content-muted mt-1">
                                                        {logMatch.reason}
                                                    </p>
                                                    <div className={reviewControlSurfaceClass}>
                                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                            <div>
                                                                <p className="text-xs font-semibold text-content-primary">Optional match</p>
                                                                <p className="text-[11px] text-content-muted">Leave extra work unmatched, or attach it to a planned session when it should count as one.</p>
                                                            </div>
                                                            <span className="text-[11px] text-content-muted">
                                                                {log.status === 'skipped' ? 'Not counted' : logMatch.planned_session_title ?? 'Auto review'}
                                                            </span>
                                                        </div>

                                                        <label className="mt-3 block text-xs text-content-muted">
                                                            Count this log as
                                                            <select
                                                                value={reviewAssignmentValue}
                                                                disabled={!isTrainingBlockActive}
                                                                onChange={(event) => applyReviewAssignmentValue(log, event.target.value)}
                                                                className={fieldClass}
                                                            >
                                                                <option value={AUTO_OVERRIDE_VALUE}>Extra / auto</option>
                                                                <option value={DOES_NOT_COUNT_VALUE}>Does not count</option>
                                                                {selectedWeekSessionOptions.map(({ day, session }) => (
                                                                    <option key={`${day.week_number}-${day.day_slot}-${session.id}`} value={`${day.day_slot}|${session.id}`}>
                                                                        {formatPlanSlot(day.day_slot)} · {session.title}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>

                                                        <details className="mt-3 group">
                                                            <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-wide text-content-muted hover:text-content-primary">
                                                                Advanced overrides
                                                            </summary>
                                                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                                <label className="text-xs text-content-muted">
                                                                    Status
                                                                    <select
                                                                        value={log.status ?? AUTO_OVERRIDE_VALUE}
                                                                        disabled={!isTrainingBlockActive}
                                                                        onChange={(event) => {
                                                                            const value = event.target.value;
                                                                            updateLogOverride(log.workout_id, {
                                                                                status: value === AUTO_OVERRIDE_VALUE ? undefined : value as TrainingBlockWorkoutStatus,
                                                                            });
                                                                        }}
                                                                        className={fieldClass}
                                                                    >
                                                                        <option value={AUTO_OVERRIDE_VALUE}>Auto</option>
                                                                        {overrideStatusOptions.map((option) => (
                                                                            <option key={option.value} value={option.value}>
                                                                                {option.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>
                                                                <label className="text-xs text-content-muted">
                                                                    Plan slot
                                                                    <select
                                                                        value={log.planned_day_slot ?? AUTO_OVERRIDE_VALUE}
                                                                        disabled={!isTrainingBlockActive}
                                                                        onChange={(event) => {
                                                                            const value = event.target.value;
                                                                            updateLogOverride(log.workout_id, {
                                                                                planned_day_slot: value === AUTO_OVERRIDE_VALUE
                                                                                    ? undefined
                                                                                    : Number.parseInt(value, 10),
                                                                            });
                                                                        }}
                                                                        className={fieldClass}
                                                                    >
                                                                        <option value={AUTO_OVERRIDE_VALUE}>Auto</option>
                                                                        {overridePlanSlotOptions.map((option) => (
                                                                            <option key={option.value} value={option.value}>
                                                                                {option.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>
                                                                <label className="text-xs text-content-muted">
                                                                    Key session
                                                                    <select
                                                                        value={log.key_session_credit ?? AUTO_OVERRIDE_VALUE}
                                                                        disabled={!isTrainingBlockActive}
                                                                        onChange={(event) => {
                                                                            const value = event.target.value;
                                                                            updateLogOverride(log.workout_id, {
                                                                                key_session_credit: value === AUTO_OVERRIDE_VALUE
                                                                                    ? undefined
                                                                                    : (value as TrainingBlockKeySessionCredit),
                                                                            });
                                                                        }}
                                                                        className={fieldClass}
                                                                    >
                                                                        <option value={AUTO_OVERRIDE_VALUE}>Auto</option>
                                                                        {overrideKeySessionOptions.map((option) => (
                                                                            <option key={option.value} value={option.value}>
                                                                                {option.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>
                                                                <label className="text-xs text-content-muted">
                                                                    Strength
                                                                    <select
                                                                        value={log.strength_status ?? AUTO_OVERRIDE_VALUE}
                                                                        disabled={!isTrainingBlockActive}
                                                                        onChange={(event) => {
                                                                            const value = event.target.value;
                                                                            updateLogOverride(log.workout_id, {
                                                                                strength_status: value === AUTO_OVERRIDE_VALUE
                                                                                    ? undefined
                                                                                    : (value as TrainingBlockStrengthStatus),
                                                                            });
                                                                        }}
                                                                        className={fieldClass}
                                                                    >
                                                                        <option value={AUTO_OVERRIDE_VALUE}>Auto</option>
                                                                        {overrideStrengthOptions.map((option) => (
                                                                            <option key={option.value} value={option.value}>
                                                                                {option.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>
                                                            </div>
                                                        </details>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>



                </Card>
            </div>

            <Modal
                open={Boolean(supportCompletionEditor)}
                onClose={closeSupportCompletionEditor}
                title="Support details"
                description={supportCompletionEditor?.session.title}
                size="md"
                placement="mobile-sheet"
            >
                {supportCompletionEditor && (
                    <form onSubmit={saveSupportCompletionEditor} className="space-y-4">
                        <label className="block text-xs font-medium text-content-muted">
                            Status
                            <select
                                value={supportCompletionEditor.form.status}
                                onChange={(event) => updateSupportCompletionForm('status', event.target.value as TrainingBlockSupportCompletionStatus)}
                                className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm text-content-primary outline-none focus:border-blue-400/70"
                            >
                                {supportCompletionOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-medium text-content-muted">
                                Minutes completed
                                <input
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={supportCompletionEditor.form.minutesCompleted}
                                    onChange={(event) => updateSupportCompletionForm('minutesCompleted', event.target.value)}
                                    placeholder="30"
                                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm text-content-primary outline-none focus:border-blue-400/70"
                                />
                            </label>
                            <label className="block text-xs font-medium text-content-muted">
                                RPE
                                <input
                                    inputMode="numeric"
                                    value={supportCompletionEditor.form.perceivedExertion}
                                    onChange={(event) => updateSupportCompletionForm('perceivedExertion', event.target.value)}
                                    placeholder="1-10"
                                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm text-content-primary outline-none focus:border-blue-400/70"
                                />
                            </label>
                        </div>

                        <label className="flex min-h-11 items-start gap-2 rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-content-secondary">
                            <input
                                type="checkbox"
                                checked={supportCompletionEditor.form.painFlag}
                                onChange={(event) => updateSupportCompletionForm('painFlag', event.target.checked)}
                                className="mt-1"
                            />
                            <span>Flag pain or discomfort</span>
                        </label>

                        <label className="block text-xs font-medium text-content-muted">
                            Notes
                            <textarea
                                value={supportCompletionEditor.form.notes}
                                onChange={(event) => updateSupportCompletionForm('notes', event.target.value)}
                                rows={4}
                                className="mt-1 w-full rounded-md border border-border bg-surface-card px-3 py-2 text-sm text-content-primary outline-none focus:border-blue-400/70"
                            />
                        </label>

                        {manualEntryError && (
                            <p className="flex items-start gap-2 text-xs text-red-300">
                                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                {manualEntryError}
                            </p>
                        )}

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeSupportCompletionEditor}
                                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface-secondary px-4 py-2 text-sm font-medium text-content-primary hover:border-blue-400/60"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={quickCompletionSavingKey === supportCompletionEditor.session.id}
                                className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {quickCompletionSavingKey === supportCompletionEditor.session.id ? 'Saving...' : 'Save support'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};
