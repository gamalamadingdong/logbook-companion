import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Calendar, CalendarDays, Flame, ListChecks, Target, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardHeader } from '../components/ui';
import { Badge } from '../components/ui';
import { ROWING_12_WEEK_TEMPLATE } from '../data/rowingTrainingBlockTemplate';
import {
    alignLogsToPlanDays,
    summarizeDayProgress,
    summarizeWeekProgress,
} from '../utils/trainingBlockCalculations';
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
    TrainingBlockReferenceRoutine,
    TrainingBlockSessionSource,
    TrainingBlockWeekSummary,
    TrainingBlockStrengthStatus,
} from '../types/trainingBlock.types';
import type { Database } from '../types/database.types';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useScopedTeamScope } from '../hooks/useScopedTeamScope';
import type { TrainingBlockWorkoutStatus } from '../types/trainingBlock.types';

type WorkoutLogRow = Database['public']['Tables']['workout_logs']['Row'];
type TrainingBlockWorkoutLogRow = Pick<
    WorkoutLogRow,
    | 'id'
    | 'completed_at'
    | 'distance_meters'
    | 'duration_seconds'
    | 'perceived_exertion'
    | 'source'
    | 'workout_name'
    | 'manual_rwn'
    | 'canonical_name'
    | 'notes'
    | 'workout_type'
    | 'user_id'
>;
type WorkoutLogOverride = Pick<
    TrainingBlockActualLogEvent,
    'status' | 'key_session_credit' | 'strength_status' | 'planned_day_slot'
>;
type TeamAthleteOption = {
    userId: string;
    name: string;
    teamName: string;
};

type TeamAssignment = GroupAssignment & {
    teamName: string;
    assignmentScope: 'team' | 'org';
};

type WorkoutLogOverrides = Record<string, WorkoutLogOverride>;

interface DayLogEvent extends TrainingBlockActualLogEvent {
    workout_name: string;
    workout_type: string;
    rawDateLabel: string;
    user_id: string;
    athlete_name?: string;
}

const TRAINING_BLOCK_OVERRIDE_STORAGE_KEY = 'training_block_log_review_overrides_v1';
const AUTO_OVERRIDE_VALUE = 'AUTO_OVERRIDE';

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

const plan = ROWING_12_WEEK_TEMPLATE;

function localDateString(dateInput: string | Date): string {
    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDistanceMeters(value: number | null | undefined): string {
    if (!value || value <= 0) return '0m';
    const km = value / 1000;
    if (km >= 10) {
        return `${km.toFixed(1)} km`;
    }
    if (km >= 1) {
        return `${Math.round(km * 10) / 10} km`;
    }
    return `${Math.round(value)} m`;
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

    const markerRegex = /\[tb:(status|key|strength|day|slot):\s*([a-z0-9_\/-]+)\]/gi;
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
    }

    return override;
}

function getDefaultPlanDate(): string {
    const today = localDateString(new Date());

    if (today < plan.start_date) {
        return plan.days[0].date;
    }

    if (today > plan.end_date) {
        return plan.days[plan.days.length - 1].date;
    }

    const exactMatch = plan.days.find((day) => day.date === today);
    if (exactMatch) return exactMatch.date;

    const firstPastIndex = plan.days.findIndex((day) => day.date > today);
    if (firstPastIndex > 0) return plan.days[firstPastIndex - 1].date;

    return plan.days[plan.days.length - 1].date;
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

function mapLogs(logs: TrainingBlockWorkoutLogRow[], athleteNameByUserId: Map<string, string>): DayLogEvent[] {
    return logs.map((log) => {
        const source: DayLogEvent['source'] = (log.source === 'concept2' || log.source === 'erg_link_live')
            ? 'concept2'
            : 'manual';
        const workoutType = log.workout_name || 'Workout';
        const workoutName = log.manual_rwn?.trim()
            || log.canonical_name
            || workoutType;
        const athleteName = athleteNameByUserId.get(log.user_id) ?? undefined;
        const markerOverrides = parseLogMarkerOverrides(log.notes);

        return {
            workout_id: log.id,
            user_id: log.user_id,
            date: localDateString(log.completed_at),
            source,
            distance_meters: log.distance_meters ?? undefined,
            duration_seconds: log.duration_seconds ?? undefined,
            perceived_exertion: log.perceived_exertion ?? undefined,
            notes: log.notes,
            workout_name: workoutName,
            workout_type: log.workout_type || workoutType,
            rawDateLabel: localDateString(log.completed_at),
            athlete_name: athleteName,
            ...markerOverrides,
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
    const [error, setError] = useState<string | null>(null);
    const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
    const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(getDefaultPlanDate());

    useEffect(() => {
        if (typeof window === 'undefined') {
            setOverridesLoaded(true);
            return;
        }

        try {
            const persisted = localStorage.getItem(TRAINING_BLOCK_OVERRIDE_STORAGE_KEY);
            if (!persisted) {
                setOverridesLoaded(true);
                return;
            }

            const parsed = JSON.parse(persisted) as WorkoutLogOverrides;
            if (typeof parsed === 'object' && parsed !== null) {
                setLogOverrides(parsed);
            }
        } catch (error) {
            console.error('Failed to load training block log overrides', error);
        } finally {
            setOverridesLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!overridesLoaded) return;
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(TRAINING_BLOCK_OVERRIDE_STORAGE_KEY, JSON.stringify(logOverrides));
        } catch (error) {
            console.error('Failed to save training block log overrides', error);
        }
    }, [logOverrides, overridesLoaded]);

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
        setLogOverrides((prev) => {
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
            } else {
                merged[workoutId] = next;
            }

            return merged;
        });
    };

    useEffect(() => {
        if (!user?.id) {
            setRawLogs([]);
            return;
        }

        const loadLogs = async () => {
            setLoading(true);
            setError(null);

            try {
                const athleteNameByUserId = new Map<string, string>();
                const planWindowStart = `${plan.start_date}T00:00:00.000Z`;
                const planWindowEnd = `${plan.end_date}T23:59:59.999Z`;

                if (isTeamContext) {
                    if (isCoachingLoading) {
                        setLoading(false);
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
                    setAthleteOptions(athleteList);

                    const teamUserIds = athleteList.map((athlete) => athlete.userId);
                    if (teamUserIds.length === 0) {
                        setAthleteOptions([]);
                        setRawLogs([]);
                        return;
                    }

                    const { data, error: fetchError } = await supabase
                        .from('workout_logs')
                        .select('id, completed_at, distance_meters, duration_seconds, perceived_exertion, source, workout_name, manual_rwn, canonical_name, notes, workout_type, user_id')
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

                    setRawLogs(mapLogs(inWindow, athleteNameByUserId));
                    return;
                }

                const { data, error: fetchError } = await supabase
                    .from('workout_logs')
                    .select('id, completed_at, distance_meters, duration_seconds, perceived_exertion, source, workout_name, manual_rwn, canonical_name, notes, workout_type, user_id')
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

                setRawLogs(mapLogs(inWindow, athleteNameByUserId));
            } catch (err) {
                console.error('Failed to load training block logs', err);
                setError('Could not load your recent workouts. Please refresh and try again.');
                setRawLogs([]);
            } finally {
                setLoading(false);
            }
        };

        loadLogs();
    }, [isTeamContext, isCoachingLoading, scopedTeamIds.join(','), user?.id, scopedTeams]);

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

    const planLogSummaries = useMemo(() => {
        return summarizeWeekProgress(plan, logs);
    }, [logs]);

    const alignedLogsByDay = useMemo(() => {
        return alignLogsToPlanDays(plan, logs, 'slot');
    }, [logs]);

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
    const selectedDaySummary = daySummariesByDate.get(selectedDay.date) ?? summarizeDayProgress(selectedDay, []);
    const selectedWeekDays = plan.days.filter((entry) => entry.week_number === selectedDay.week_number);
    const selectedWeekStart = selectedWeekDays[0]?.date ?? selectedDay.date;
    const selectedWeekEnd = selectedWeekDays[selectedWeekDays.length - 1]?.date ?? selectedDay.date;
    const selectedDayKey = `${selectedDay.week_number}:${selectedDay.day_slot}`;
    const selectedDayLogs = (alignedLogsByDay.get(selectedDayKey) ?? []) as DayLogEvent[];
    const selectedWeekLogs = selectedWeekDays.flatMap((entry) => (alignedLogsByDay.get(`${entry.week_number}:${entry.day_slot}`) ?? []) as DayLogEvent[]);
    const selectedReference = selectedDay.reference;

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
                const weekSummaries = summarizeWeekProgress(plan, athleteLogs);
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
    ]);
    const selectedWeekAssignments = useMemo(() => {
        if (teamAssignments.length === 0) return [];

        return teamAssignments.filter((assignment) => assignment.scheduled_date >= selectedWeekStart && assignment.scheduled_date <= selectedWeekEnd);
    }, [selectedWeekEnd, selectedWeekStart, teamAssignments]);

    const selectedDayAssignments = useMemo(() => {
        return selectedWeekAssignments.filter((assignment) => assignment.scheduled_date === selectedDay.date);
    }, [selectedDay.date, selectedWeekAssignments]);

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

    if (authLoading || loading) {
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
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-2">Phase 2</p>
                        <h1 className="text-3xl font-bold text-white">12-week training block</h1>
                        <p className="text-neutral-400 mt-2">
                            Pete 12-week structure from the same local plan template. This view reads your logged workouts and
                            shows where they satisfy your planned stimulus. No writes yet.
                        </p>
                        {isTeamContext && (
                            <p className="text-sm text-neutral-400 mt-3">
                                Viewing {selectedAthleteLabel}. Scope: {scopeTeamText}.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                                            <p className="text-sm font-medium text-white">
                                                {athleteSummary.athleteName}
                                            </p>
                                            <p className="text-xs text-neutral-500 mt-1">
                                                {athleteSummary.teamName}
                                            </p>
                                        </div>
                                        <div className="text-xs text-right text-neutral-300">
                                            <p>{athleteSummary.weekCoverage}%</p>
                                            <p className="text-neutral-500">
                                                {formatDistanceMeters(athleteSummary.actualDistance)} / {formatDistanceMeters(athleteSummary.targetDistance)}
                                            </p>
                                            <p className="text-neutral-500 mt-1">
                                                Slot coverage: {athleteSummary.coveredSlots}/7
                                            </p>
                                            <p className="text-neutral-500 mt-1">
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
                                    selectedWeekAssignments.map((assignment) => (
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
                                                <Badge variant="info" dot>
                                                    {assignment.scheduled_date}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-neutral-500 mt-1">
                                                {assignment.teamName} · {assignment.assignmentScope}
                                            </p>
                                            {assignment.instructions && (
                                                <p className="text-xs text-neutral-400 mt-1">Instructions: {assignment.instructions}</p>
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
                                    ))
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
                        title="Block progress"
                        subtitle={isTeamContext
                            ? `${scopeTeamText} · ${selectedAthleteLabel}`
                            : 'Week summary over your configured 12-week template window'
                        }
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-neutral-500 uppercase">Week</p>
                            <p className="text-2xl font-semibold mt-1">Week {selectedWeekSummary?.week_number ?? 1}</p>
                        </div>
                        <div>
                            <p className="text-xs text-neutral-500 uppercase">Target distance</p>
                            <p className="text-2xl font-semibold mt-1">
                                {selectedWeekSummary
                                    ? formatDistanceMeters(selectedWeekSummary.target_distance_meters)
                                    : '-'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-neutral-500 uppercase">Actual distance</p>
                            <p className="text-2xl font-semibold mt-1">
                                {selectedWeekSummary
                                    ? formatDistanceMeters(selectedWeekSummary.actual_distance_meters)
                                    : '-'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-neutral-500 uppercase">Coverage</p>
                            <p className="text-2xl font-semibold mt-1">{weekCoverage}%</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${weekCoverage}%` }}
                            />
                        </div>
                        <div className="mt-2 text-xs text-neutral-400 flex flex-wrap gap-4">
                            <span>{selectedWeekSummary?.day_summaries.length ?? 0} planned day slots</span>
                            <span>{selectedWeekSummary?.key_session_credits.earned ?? 0} / {selectedWeekSummary?.key_session_credits.possible ?? 0} key sessions</span>
                            <span><Flame size={12} className="inline-block mr-1 text-amber-400" /> {selectedWeekLoad.toFixed(1)} load</span>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {planLogSummaries.map((weekSummary) => {
                            const firstDay = plan.days.find((day) => day.week_number === weekSummary.week_number);
                            const isSelected = weekSummary.week_number === selectedWeekSummary?.week_number;
                            const coverage = Math.min(100, Math.round(weekSummary.target_coverage_ratio * 100));
                            const keyText = `${weekSummary.key_session_credits.earned}/${weekSummary.key_session_credits.possible}`;

                            return (
                                <button
                                    key={weekSummary.week_number}
                                    type="button"
                                    onClick={() => {
                                        if (firstDay) {
                                            setSelectedDate(firstDay.date);
                                        }
                                    }}
                                    className={`text-left rounded-xl border px-4 py-3 transition-all ${
                                        isSelected
                                            ? 'border-emerald-500/60 bg-emerald-900/10'
                                            : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-white">Week {weekSummary.week_number}</span>
                                        <ArrowRight size={14} className="text-neutral-500" />
                                    </div>
                                    <div className="text-xs text-neutral-500 mt-2">Target {formatDistanceMeters(weekSummary.target_distance_meters)}</div>
                                    <div className="mt-2 text-sm">{coverage}% target achieved</div>
                                    <div className="h-1.5 bg-neutral-800 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${coverage >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                            style={{ width: `${coverage}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-neutral-500 mt-2">
                                        {keyText} key sessions · {formatDistanceMeters(weekSummary.actual_distance_meters)} actual
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </Card>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <Card className="xl:col-span-1">
                        <CardHeader
                            title={`Week ${selectedDay.week_number}`}
                            subtitle="Select a day to review or jump plan alignment"
                        />
                                <div className="space-y-2">
                                {selectedWeekDays.map((day) => {
                                const daySummary = daySummariesByDate.get(day.date) ?? summarizeDayProgress(day, []);
                                const isSelected = day.date === selectedDay.date;
                                const style = statusTone[daySummary.status];
                                const dailyLogs = alignedLogsByDay.get(`${day.week_number}:${day.day_slot}`) ?? [];
                                const dayAssignments = assignmentsByDate.get(day.date) ?? [];
                                return (
                                    <button
                                        key={day.date}
                                        type="button"
                                        onClick={() => setSelectedDate(day.date)}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                                            isSelected
                                                ? 'border-emerald-500/60 bg-emerald-900/10'
                                                : 'border-neutral-800 hover:border-neutral-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-white">
                                                    {day.day_of_week} · {formatWeekday(day.date)}
                                                </p>
                                                <p className="text-xs text-neutral-500 mt-1">
                                                    Planned {formatDistanceMeters(day.planned_distance_meters)} · {day.planned_distance_meters > 0 ? 'Row day' : 'Cross/rest day'}
                                                </p>
                                            </div>
                                            <Badge variant={style.variant} dot={style.dot}>
                                                {statusLabel[daySummary.status]}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-neutral-400 mt-2">
                                            Actual {formatDistanceMeters(daySummary.actual_distance_meters)}
                                            {dailyLogs.length > 0 ? ` · ${dailyLogs.length} log${dailyLogs.length === 1 ? '' : 's'}` : ' · Not yet logged'}
                                            {dayAssignments.length > 0 ? ` · ${dayAssignments.length} team prescription${dayAssignments.length === 1 ? '' : 's'}` : ''}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    <Card className="xl:col-span-2">
                        <CardHeader
                            title={`${selectedDay.day_of_week} · ${formatWeekday(selectedDay.date)}`}
                            subtitle="Planned sessions and what matched from today's logs"
                            action={
                                <Badge variant={statusTone[selectedDaySummary.status].variant} dot>
                                    {statusLabel[selectedDaySummary.status]}
                                </Badge>
                            }
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedDayAssignments.length > 0 && (
                                <section className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 md:col-span-2">
                                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                        <Users size={16} className="text-indigo-400" />
                                        Team prescriptions for this date
                                    </h3>
                                    <div className="space-y-2">
                                        {selectedDayAssignments.map((assignment) => (
                                            <div
                                                key={assignment.id}
                                                className="rounded-lg border border-neutral-800 px-3 py-2.5 text-sm"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="text-white">{assignment.canonical_name ?? assignment.title ?? 'Unnamed assignment'}</p>
                                                    <span className="text-xs text-neutral-400">
                                                        {assignment.teamName}
                                                    </span>
                                                </div>
                                                {assignment.instructions && (
                                                    <p className="text-xs text-neutral-500 mt-1">
                                                        Instructions: {assignment.instructions}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Target size={16} className="text-emerald-400" />
                                    Planned intent
                                </h3>
                                <p className="text-xs text-neutral-500 mb-3">
                                    Planned distance this day: {formatDistanceMeters(selectedDay.planned_distance_meters)}
                                </p>
                                <div className="space-y-3">
                                    {selectedDay.sessions.map((session) => (
                                        (() => {
                                            const routine = resolveRoutineForSession(selectedReference, session.title, session.source);

                                            return (
                                                <div
                                                    key={session.id}
                                                    className="rounded-lg border border-neutral-800 p-3 text-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <p className="font-medium text-white">{session.title}</p>
                                                        <Badge variant={session.is_key_session ? 'coaching' : 'muted'}>
                                                            {sourceLabel[session.source]}
                                                        </Badge>
                                                    </div>
                                                    {session.planned_rwn && (
                                                        <p className="text-xs text-emerald-300 mt-1">
                                                            RWN: {session.planned_rwn}
                                                        </p>
                                                    )}
                                                    <p className="text-neutral-500 mt-1">
                                                        {session.expected_distance_meters ? `${formatDistanceMeters(session.expected_distance_meters)} planned` : 'Duration/effort focused'}
                                                        {session.target_split_seconds_per_500m ? ` · target ${(session.target_split_seconds_per_500m / 10).toFixed(1)}s/500m` : ''}
                                                    </p>
                                                    {session.instructions && session.instructions.length > 0 && (
                                                        <ul className="mt-2 text-xs text-neutral-400 list-disc list-inside">
                                                            {session.instructions.map((instruction) => (
                                                                <li key={instruction}>{instruction}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    {routine && routine.exercises && routine.exercises.length > 0 && (
                                                        <div className="mt-3 border-t border-neutral-800 pt-3">
                                                            <p className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
                                                                {routine.kind} routine
                                                            </p>
                                                            <p className="text-[11px] text-neutral-500 mb-2">
                                                                Focus: {routine.focus.join(', ')}
                                                            </p>
                                                            <ul className="space-y-1 text-xs text-neutral-300 list-disc list-inside">
                                                                {routine.exercises.map((exercise) => (
                                                                    <li key={`${exercise.name}-${exercise.sets}-${exercise.reps}`}>
                                                                        <span className="text-neutral-100">{exercise.name}</span>
                                                                        {' '}
                                                                        {formatExerciseSetNotation(exercise.sets, exercise.reps)}
                                                                        {exercise.notes ? ` · ${exercise.notes}` : ''}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            {routine.notes && routine.notes.length > 0 && (
                                                                <div className="mt-2">
                                                                    <p className="text-[11px] text-neutral-500">Coach notes</p>
                                                                    <ul className="text-xs list-disc list-inside text-neutral-300 mt-1">
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
                                    <div className="mt-4 pt-3 border-t border-neutral-800">
                                        <p className="text-xs uppercase tracking-wide text-neutral-400 mb-3">Support prep</p>
                                        <div className="space-y-2">
                                            {formatReferenceList(selectedReference.warmup, 'Warm-up')}
                                            {formatReferenceList(selectedReference.core, 'Core')}
                                            {formatReferenceList(selectedReference.stretching, 'Stretching')}
                                        </div>
                                    </div>
                                )}
                                {selectedReference && selectedReference.routines.length === 0 && selectedDay.sessions.every((session) => session.source !== 'strength') && (
                                    <p className="mt-4 text-[11px] text-neutral-500">
                                        This day has support prep and no scheduled strength slot.
                                    </p>
                                )}
                            </section>

                            <section className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <CalendarDays size={16} className="text-blue-400" />
                                    Logged workouts ({selectedDayLogs.length})
                                </h3>
                                {selectedDayLogs.length === 0 ? (
                                    <p className="text-sm text-neutral-500">No workouts recorded for this day yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedDayLogs.map((log) => {
                                            const tone = sourceTone[log.source];
                                            return (
                                                <div
                                                    key={log.workout_id}
                                                    className="rounded-lg border border-neutral-800 p-3 text-sm"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-medium text-white">{log.workout_name}</p>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs ${tone.text} ${tone.bg}`}>
                                                            {tone.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-neutral-400 mt-1">
                                                        {log.workout_type} · {formatDistanceMeters(log.distance_meters)} · RPE {log.perceived_exertion ?? '-'}
                                                    </p>
                                                    {isTeamContext && (
                                                        <p className="text-neutral-500 text-xs mt-1">
                                                            Athlete: {log.athlete_name ?? 'Unknown athlete'}
                                                        </p>
                                                    )}
                                                    <p className="text-neutral-500 text-xs mt-1">
                                                        {formatDuration(log.duration_seconds)} · {log.notes ? 'With notes' : 'No notes'}
                                                    </p>
                                                    <div className="mt-2 border-t border-neutral-800 pt-2">
                                                        <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                                                            Plan review overrides
                                                        </p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                                            <label className="text-xs text-neutral-400">
                                                                Status
                                                                <select
                                                                    value={log.status ?? AUTO_OVERRIDE_VALUE}
                                                                    onChange={(event) => {
                                                                        const value = event.target.value;
                                                                        updateLogOverride(log.workout_id, {
                                                                            status: value === AUTO_OVERRIDE_VALUE ? undefined : value as TrainingBlockWorkoutStatus,
                                                                        });
                                                                    }}
                                                                    className="mt-1 w-full rounded bg-neutral-950 border border-neutral-800 text-xs text-white px-2 py-1"
                                                                >
                                                                    <option value={AUTO_OVERRIDE_VALUE}>Auto</option>
                                                                    {overrideStatusOptions.map((option) => (
                                                                        <option key={option.value} value={option.value}>
                                                                            {option.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <label className="text-xs text-neutral-400">
                                                                Plan slot
                                                                <select
                                                                    value={log.planned_day_slot ?? AUTO_OVERRIDE_VALUE}
                                                                    onChange={(event) => {
                                                                        const value = event.target.value;
                                                                        updateLogOverride(log.workout_id, {
                                                                            planned_day_slot: value === AUTO_OVERRIDE_VALUE
                                                                                ? undefined
                                                                                : Number.parseInt(value, 10),
                                                                        });
                                                                    }}
                                                                    className="mt-1 w-full rounded bg-neutral-950 border border-neutral-800 text-xs text-white px-2 py-1"
                                                                >
                                                                    <option value={AUTO_OVERRIDE_VALUE}>Auto</option>
                                                                    {overridePlanSlotOptions.map((option) => (
                                                                        <option key={option.value} value={option.value}>
                                                                            {option.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <label className="text-xs text-neutral-400">
                                                                Key session
                                                                <select
                                                                    value={log.key_session_credit ?? AUTO_OVERRIDE_VALUE}
                                                                    onChange={(event) => {
                                                                        const value = event.target.value;
                                                                        updateLogOverride(log.workout_id, {
                                                                            key_session_credit: value === AUTO_OVERRIDE_VALUE
                                                                                ? undefined
                                                                                : (value as TrainingBlockKeySessionCredit),
                                                                        });
                                                                    }}
                                                                    className="mt-1 w-full rounded bg-neutral-950 border border-neutral-800 text-xs text-white px-2 py-1"
                                                                >
                                                                    <option value={AUTO_OVERRIDE_VALUE}>Auto</option>
                                                                    {overrideKeySessionOptions.map((option) => (
                                                                        <option key={option.value} value={option.value}>
                                                                            {option.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <label className="text-xs text-neutral-400">
                                                                Strength
                                                                <select
                                                                    value={log.strength_status ?? AUTO_OVERRIDE_VALUE}
                                                                    onChange={(event) => {
                                                                        const value = event.target.value;
                                                                        updateLogOverride(log.workout_id, {
                                                                            strength_status: value === AUTO_OVERRIDE_VALUE
                                                                                ? undefined
                                                                                : (value as TrainingBlockStrengthStatus),
                                                                        });
                                                                    }}
                                                                    className="mt-1 w-full rounded bg-neutral-950 border border-neutral-800 text-xs text-white px-2 py-1"
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
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>

                        <section className="mt-4 bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-white">Day summary</h3>
                                <span className="text-xs text-neutral-500">
                                    {selectedWeekLogs.length} workouts in week {selectedDay.week_number}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                                <div>
                                    <p className="text-xs text-neutral-500">Actual</p>
                                    <p className="text-lg font-semibold">{formatDistanceMeters(dayActualDistance)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-neutral-500">Load</p>
                                    <p className="text-lg font-semibold">{dayLoad.toFixed(1)} AU</p>
                                </div>
                                <div>
                                    <p className="text-xs text-neutral-500">Sessions logged</p>
                                    <p className="text-lg font-semibold">{selectedDaySummary.logged_session_count}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-neutral-500">Key credit</p>
                                    <p className="text-lg font-semibold">{selectedDaySummary.key_session_credit}</p>
                                </div>
                            </div>
                        </section>
                    </Card>
                </div>
            </div>
        </div>
    );
};
