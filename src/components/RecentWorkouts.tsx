import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Snowflake, Waves, ChevronLeft, ChevronRight, Search, Loader2, X } from 'lucide-react';
import { workoutService } from '../services/workoutService';
import { getPersonalRecords } from '../services/personalRecordService';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface RecentWorkoutSummary {
    id: number | string;
    date: string;
    distance: number;
    durationSeconds?: number | null;
    time_formatted?: string | null;
    time?: number | null;
    type?: string | null;
    name: string;
    manual_rwn?: string | null;
    db_id?: string | null;
}

interface RecentWorkoutsProps {
    userId?: number | string;
    workouts: RecentWorkoutSummary[];
    isLoading?: boolean;
    currentPage: number;
    hasMore: boolean;
    onPageChange: (newPage: number) => void;
}

interface WorkoutSearchControllerOptions {
    setQuery: (query: string) => void;
    setSearchResults: (results: RecentWorkoutSummary[]) => void;
    setSearching: (searching: boolean) => void;
    focusSearchInput: () => void;
    clearTimeout: (handle: number) => void;
}

type ActivityCategory = 'All' | string;

interface VisibleWorkoutTotalsInput {
    distance?: unknown;
    time?: unknown;
}

interface VisibleWorkoutTotals {
    count: number;
    distance: number;
    duration: number;
}

export const getActivityCategory = ({ type }: Pick<RecentWorkoutSummary, 'type'>): string => {
    const normalizedType = type?.trim().toLowerCase() ?? '';
    const deviceCategories: Record<string, string> = {
        rower: 'Row',
        bike: 'Bike',
        skierg: 'Ski',
    };

    if (deviceCategories[normalizedType]) return deviceCategories[normalizedType];
    return normalizedType.replace(/\b\w/g, (character) => character.toUpperCase());
};

export const filterWorkoutsByActivityCategory = <T extends Pick<RecentWorkoutSummary, 'type'>>(
    sourceWorkouts: T[],
    category: ActivityCategory,
): T[] => category === 'All'
    ? sourceWorkouts
    : sourceWorkouts.filter((workout) => getActivityCategory(workout) === category);

export const formatAveragePace = (distanceMeters?: number | null, durationSeconds?: number | null): string => {
    if (
        typeof distanceMeters !== 'number'
        || !Number.isFinite(distanceMeters)
        || distanceMeters <= 0
        || typeof durationSeconds !== 'number'
        || !Number.isFinite(durationSeconds)
        || durationSeconds <= 0
    ) {
        return '–';
    }

    const paceTenths = Math.round((durationSeconds / distanceMeters) * 5000);
    const minutes = Math.floor(paceTenths / 600);
    const seconds = ((paceTenths % 600) / 10).toFixed(1).padStart(4, '0');

    return `${minutes}:${seconds}/500m`;
};

const getLocalCalendarDay = (date: Date): number => Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
);

export const formatRelativeWorkoutDay = (recordedDate: string, now = new Date()): string => {
    const recorded = /^\d{4}-\d{2}-\d{2}$/.test(recordedDate)
        ? new Date(`${recordedDate}T00:00:00`)
        : new Date(recordedDate);
    const daysAgo = Math.max(0, Math.floor(
        (getLocalCalendarDay(now) - getLocalCalendarDay(recorded)) / 86_400_000,
    ));

    return daysAgo === 0
        ? 'today'
        : `${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`;
};

export const calculateVisibleWorkoutTotals = (
    visibleWorkouts: readonly VisibleWorkoutTotalsInput[],
): VisibleWorkoutTotals => visibleWorkouts.reduce<VisibleWorkoutTotals>((totals, workout) => ({
    count: totals.count + 1,
    distance: totals.distance + (
        typeof workout.distance === 'number' && Number.isFinite(workout.distance)
            ? workout.distance
            : 0
    ),
    duration: totals.duration + (
        typeof workout.time === 'number' && Number.isFinite(workout.time)
            ? workout.time
            : 0
    ),
}), { count: 0, distance: 0, duration: 0 });

export const formatWorkoutSearchSummary = (
    searchResults: readonly VisibleWorkoutTotalsInput[],
): string | null => {
    if (searchResults.length === 0) return null;

    const { count, distance } = calculateVisibleWorkoutTotals(searchResults);
    const distanceLabel = distance >= 1000
        ? `${(distance / 1000).toFixed(1).replace(/\.0$/, '')} km`
        : `${distance} m`;
    const workoutLabel = count === 1 ? 'matching workout' : 'matching workouts';

    return `${count} ${workoutLabel} · ${distanceLabel} total distance`;
};

export const createPersonalRecordWorkoutIdSet = (
    records: readonly { workout_id: string | null }[] = [],
): Set<string> => new Set(
    records
        .map((record) => record.workout_id)
        .filter((workoutId): workoutId is string => typeof workoutId === 'string'),
);

export const loadPersonalRecordWorkoutIdSet = async (
    userId: number | string | undefined,
    readPersonalRecords: typeof getPersonalRecords = getPersonalRecords,
): Promise<Set<string>> => {
    if (!userId) return new Set();

    try {
        return createPersonalRecordWorkoutIdSet(await readPersonalRecords(String(userId)));
    } catch {
        return new Set();
    }
};

const formatTotalDuration = (durationTenths: number): string => {
    const totalSeconds = Math.floor(durationTenths / 10);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');

    return `${minutes}:${seconds}`;
};

export const createWorkoutSearchController = ({
    setQuery,
    setSearchResults,
    setSearching,
    focusSearchInput,
    clearTimeout,
}: WorkoutSearchControllerOptions) => {
    let generation = 0;
    let pendingTimer: number | undefined;

    const cancelPendingTimer = () => {
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer);
            pendingTimer = undefined;
        }
    };

    return {
        beginSearch: () => {
            generation += 1;
            cancelPendingTimer();
            return generation;
        },
        setPendingTimer: (handle: number) => {
            pendingTimer = handle;
        },
        clearPendingTimer: (handle: number) => {
            if (pendingTimer === handle) pendingTimer = undefined;
        },
        isCurrent: (searchGeneration: number) => searchGeneration === generation,
        clearSearch: () => {
            generation += 1;
            cancelPendingTimer();
            setQuery('');
            setSearchResults([]);
            setSearching(false);
            focusSearchInput();
        },
    };
};

export const WorkoutSearchClearButton: React.FC<{ onClear: () => void }> = ({ onClear }) => (
    <button
        type="button"
        onClick={onClear}
        aria-label="Clear workout search"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
    >
        <X size={16} aria-hidden="true" />
    </button>
);

export const RecentWorkouts: React.FC<RecentWorkoutsProps> = ({
    userId,
    workouts,
    isLoading = false,
    currentPage,
    hasMore,
    onPageChange
}) => {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RecentWorkoutSummary[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>('All');
    const [personalRecordWorkoutIds, setPersonalRecordWorkoutIds] = useState<Set<string>>(() => new Set());
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchControllerRef = useRef<ReturnType<typeof createWorkoutSearchController> | null>(null);

    if (!searchControllerRef.current) {
        searchControllerRef.current = createWorkoutSearchController({
            setQuery,
            setSearchResults,
            setSearching,
            focusSearchInput: () => searchInputRef.current?.focus(),
            clearTimeout: window.clearTimeout,
        });
    }

    const searchController = searchControllerRef.current;

    useEffect(() => {
        let cancelled = false;
        setPersonalRecordWorkoutIds(new Set());

        const loadPersonalRecordWorkoutIds = async () => {
            const recordWorkoutIds = await loadPersonalRecordWorkoutIdSet(userId);
            if (!cancelled) {
                setPersonalRecordWorkoutIds(recordWorkoutIds);
            }
        };

        void loadPersonalRecordWorkoutIds();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        const searchGeneration = searchController.beginSearch();
        const handle = window.setTimeout(async () => {
            searchController.clearPendingTimer(handle);
            setSearching(true);
            try {
                const results = await workoutService.searchWorkouts(trimmed);
                if (searchController.isCurrent(searchGeneration)) {
                    setSearchResults(results as RecentWorkoutSummary[]);
                }
            } catch (error) {
                console.error('Workout search failed', error);
                if (searchController.isCurrent(searchGeneration)) {
                    setSearchResults([]);
                }
            } finally {
                if (searchController.isCurrent(searchGeneration)) {
                    setSearching(false);
                }
            }
        }, 250);
        searchController.setPendingTimer(handle);

        return () => window.clearTimeout(handle);
    }, [query, searchController]);

    const searchActive = query.trim().length >= 2;
    const sourceWorkouts = useMemo(() => (searchActive ? searchResults : workouts), [searchActive, searchResults, workouts]);
    const activityCategories = useMemo(
        () => [...new Set(sourceWorkouts.map(getActivityCategory).filter(Boolean))],
        [sourceWorkouts],
    );
    const visibleWorkouts = useMemo(
        () => filterWorkoutsByActivityCategory(sourceWorkouts, selectedCategory),
        [sourceWorkouts, selectedCategory],
    );
    const visibleWorkoutTotals = useMemo(
        () => calculateVisibleWorkoutTotals(visibleWorkouts),
        [visibleWorkouts],
    );
    const searchSummary = searchActive && !searching
        ? formatWorkoutSearchSummary(searchResults)
        : null;
    const isPersonalRecordWorkout = (workout: RecentWorkoutSummary): boolean => (
        personalRecordWorkoutIds.has(String(workout.id))
        || (typeof workout.db_id === 'string' && personalRecordWorkoutIds.has(workout.db_id))
    );

    if (isLoading && workouts.length === 0) return <div className="text-neutral-400 p-6 animate-pulse">Loading workouts...</div>;

    const getMachineIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('bike')) return <Bike size={16} className="text-amber-400" />;
        if (t.includes('ski')) return <Snowflake size={16} className="text-cyan-400" />;
        return <Waves size={16} className="text-emerald-400" />;
    };

    const formatMachineType = (type: string) => {
        // Concept2 returns "rower", "bike", "skierg"
        if (type === 'rower') return 'RowErg';
        if (type === 'bike') return 'BikeErg';
        if (type === 'skierg') return 'SkiErg';
        return type.replace(/([A-Z])/g, ' $1').trim();
    };

    return (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Recent Workouts</h2>
                    <p className="text-neutral-400 text-sm">Your latest activity from the Logbook</p>
                </div>
            </div>

            <div className="mb-5">
                <label htmlFor="recent-workout-search" className="sr-only">Search workout history</label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                    <input
                        ref={searchInputRef}
                        id="recent-workout-search"
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search workout history by RWN or keyword"
                        className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-3 pl-10 pr-10 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {query.length > 0 ? (
                        <WorkoutSearchClearButton onClear={searchController.clearSearch} />
                    ) : searching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-neutral-500" size={16} />
                    )}
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                    Search all logged workouts by canonical name, manual RWN, or workout label.
                </p>
            </div>

            {activityCategories.length > 0 && (
                <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Filter workouts by activity category">
                    {(['All', ...activityCategories] as ActivityCategory[]).map((category) => (
                        <Button
                            key={category}
                            type="button"
                            size="sm"
                            variant={selectedCategory === category ? 'primary' : 'secondary'}
                            aria-pressed={selectedCategory === category}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </Button>
                    ))}
                </div>
            )}

            <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm" aria-label="Visible workout totals">
                <span className="text-content-secondary">
                    <span className="font-medium text-content-primary">{visibleWorkoutTotals.count}</span> workouts
                </span>
                <span className="text-content-secondary">
                    <span className="font-medium text-content-primary">{visibleWorkoutTotals.distance}m</span> total distance
                </span>
                <span className="text-content-secondary">
                    <span className="font-medium text-accent-primary">{formatTotalDuration(visibleWorkoutTotals.duration)}</span> total time
                </span>
            </div>

            {searchSummary && (
                <p className="mb-5 text-sm text-content-secondary" role="status" aria-live="polite">
                    {searchSummary}
                </p>
            )}

            <div className="space-y-3 md:hidden">
                {visibleWorkouts.map((workout) => (
                    <article
                        key={workout.id || workout.db_id}
                        className="rounded-xl border border-border bg-surface-secondary p-4"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-content-primary">
                                    {new Date(workout.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <span className="text-xs text-content-muted">
                                    {formatRelativeWorkoutDay(workout.date)}
                                </span>
                                <div className="mt-1 flex items-center gap-2">
                                    <p className="text-sm text-content-secondary">{workout.name}</p>
                                    {isPersonalRecordWorkout(workout) && <Badge variant="success" size="sm">PR</Badge>}
                                </div>
                                <p className="mt-1 text-xs text-content-secondary">
                                    {workout.manual_rwn ? `RWN: ${workout.manual_rwn}` : formatMachineType(workout.type ?? '')}
                                </p>
                            </div>
                            <Link
                                to={`/workout/${workout.id || workout.db_id}`}
                                className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-accent-coaching bg-accent-coaching-surface px-3 text-xs font-medium text-accent-coaching transition-colors hover:border-accent-coaching-hover hover:bg-accent-coaching hover:text-content-primary"
                            >
                                Analyze
                            </Link>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                            <div>
                                <dt className="text-xs text-content-secondary">Distance</dt>
                                <dd className="mt-1 font-mono text-base text-content-primary">{workout.distance}m</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-content-secondary">Time</dt>
                                <dd className="mt-1 font-mono font-medium text-accent-primary">
                                    {workout.time_formatted || (workout.time ? (workout.time / 10).toFixed(1) + 's' : '-')}
                                </dd>
                            </div>
                        </dl>
                    </article>
                ))}
            </div>

            <div className="hidden md:block">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                    <thead>
                        <tr className="border-b border-neutral-800 text-neutral-400 text-xs font-semibold uppercase tracking-wider">
                            <th className="pb-4 pl-4">Date</th>
                            <th className="pb-4">Distance</th>
                            <th className="pb-4">Time</th>
                            <th className="pb-4">Average pace</th>
                            <th className="pb-4">Workout</th>
                            <th className="pb-4 pr-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                        {visibleWorkouts.map((workout) => (
                            <tr key={workout.id || workout.db_id} className="text-sm hover:bg-neutral-800/40 transition-colors group">
                                <td className="py-4 pl-4 text-neutral-300 font-medium">
                                    <div>
                                        {new Date(workout.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                    <span className="text-xs font-normal text-content-muted">
                                        {formatRelativeWorkoutDay(workout.date)}
                                    </span>
                                </td>
                                <td className="py-4 font-mono text-white text-base">{workout.distance}m</td>
                                <td className="py-4 font-mono text-emerald-400 font-medium">
                                    {workout.time_formatted || (workout.time ? (workout.time / 10).toFixed(1) + 's' : '-')}
                                </td>
                                <td className="py-4 font-mono text-content-secondary font-medium whitespace-nowrap">
                                    {formatAveragePace(workout.distance, workout.durationSeconds)}
                                </td>
                                <td className="py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-neutral-800 rounded-lg">
                                            {getMachineIcon(workout.type ?? 'rower')}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm font-medium text-white">{workout.name}</div>
                                                {isPersonalRecordWorkout(workout) && <Badge variant="success" size="sm">PR</Badge>}
                                            </div>
                                            <div className="text-xs text-neutral-500">
                                                {workout.manual_rwn ? `RWN: ${workout.manual_rwn}` : formatMachineType(workout.type ?? '')}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 pr-4 text-right">
                                    <Link
                                        to={`/workout/${workout.id || workout.db_id}`}
                                        className="text-indigo-400 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500 hover:border-indigo-500 transition-all inline-block"
                                    >
                                        Analyze
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {!searchActive && visibleWorkouts.length > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-neutral-800">
                        <p className="text-sm text-neutral-500">
                            Page <span className="text-neutral-300 font-medium">{currentPage + 1}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage === 0 || isLoading}
                                className="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1"
                            >
                                <ChevronLeft size={14} />
                                Previous
                            </button>
                            <button
                                onClick={() => onPageChange(currentPage + 1)}
                                disabled={!hasMore || isLoading}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1"
                            >
                                {isLoading ? 'Loading...' : <>Next <ChevronRight size={14} /></>}
                            </button>
                        </div>
                    </div>
                )
            }

            {visibleWorkouts.length === 0 && !isLoading && !searching && (
                <div className="text-center py-12 text-neutral-500">
                    {selectedCategory !== 'All'
                        ? `No ${selectedCategory.toLowerCase()} workouts matched this filter.`
                        : searchActive
                            ? 'No workouts matched that search.'
                            : 'No workouts found. Sync your logbook to get started.'}
                </div>
            )}
        </div >
    );
};
