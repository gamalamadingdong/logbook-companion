import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
    calculateVisibleWorkoutTotals,
    createPersonalRecordWorkoutIdSet,
    createWorkoutSearchController,
    filterWorkoutsByActivityCategory,
    formatAveragePace,
    formatWorkoutPace,
    formatRelativeWorkoutDay,
    formatWorkoutSearchSummary,
    getActivityCategory,
    loadPersonalRecordWorkoutIdSet,
    RecentWorkouts,
    WorkoutSearchClearButton,
} from './RecentWorkouts';

describe('personal-record workout matching', () => {
    it('matches only workout IDs returned by the owner-scoped personal-record read', () => {
        const personalRecordWorkoutIds = createPersonalRecordWorkoutIdSet([
            { workout_id: 'personal-record-workout' },
            { workout_id: null },
        ]);

        expect(personalRecordWorkoutIds.has(String('personal-record-workout'))).toBe(true);
        expect(personalRecordWorkoutIds.has('ordinary-workout')).toBe(false);
    });

    it('treats an empty personal-record read as an empty match set', () => {
        expect(createPersonalRecordWorkoutIdSet([]).size).toBe(0);
        expect(createPersonalRecordWorkoutIdSet().size).toBe(0);
    });

    it('treats a failed owner-scoped personal-record read as an empty match set', async () => {
        await expect(loadPersonalRecordWorkoutIdSet('user-123', async () => {
            throw new Error('Unable to read records');
        })).resolves.toEqual(new Set());
    });
});

describe('formatRelativeWorkoutDay', () => {
    it('treats a date-only value as the local calendar day', () => {
        const now = new Date();
        now.setHours(0, 15, 0, 0);
        const localDateOnly = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
        ].join('-');
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayDateOnly = [
            yesterday.getFullYear(),
            String(yesterday.getMonth() + 1).padStart(2, '0'),
            String(yesterday.getDate()).padStart(2, '0'),
        ].join('-');

        expect(formatRelativeWorkoutDay(localDateOnly, now)).toBe('today');
        expect(formatRelativeWorkoutDay(yesterdayDateOnly, now)).toBe('1 day ago');
    });

    it('compares timestamp calendar days without drifting across a local midnight boundary', () => {
        const now = new Date();
        now.setHours(0, 5, 0, 0);
        const recordedNearMidnightDate = new Date(now);
        recordedNearMidnightDate.setDate(now.getDate() - 1);
        recordedNearMidnightDate.setHours(23, 55, 0, 0);

        expect(formatRelativeWorkoutDay(recordedNearMidnightDate.toISOString(), now)).toBe('1 day ago');
    });
});

describe('calculateVisibleWorkoutTotals', () => {
    it('sums the count, distance, and duration for the current page of visible workouts', () => {
        expect(calculateVisibleWorkoutTotals([
            { distance: 2000, time: 4800 },
            { distance: 1500, time: 3600 },
        ])).toEqual({ count: 2, distance: 3500, duration: 8400 });
    });

    it('uses total meters rowed when measured recovery distance is available', () => {
        expect(calculateVisibleWorkoutTotals([
            { distance: 1000, totalDistance: 1400, time: 2400 },
        ])).toEqual({ count: 1, distance: 1400, duration: 2400 });
    });

    it('ignores missing and non-numeric durations without producing NaN', () => {
        expect(calculateVisibleWorkoutTotals([
            { distance: 2000, time: 4800 },
            { distance: 1000, time: undefined },
            { distance: 500, time: 'not-a-duration' },
        ])).toEqual({ count: 3, distance: 3500, duration: 4800 });
    });

    it('uses the active search result rows as its aggregation boundary', () => {
        const activeSearchResults = [
            { distance: 1000, time: 2400 },
            { distance: 500, time: 1200 },
        ];

        expect(calculateVisibleWorkoutTotals(activeSearchResults)).toEqual({
            count: 2,
            distance: 1500,
            duration: 3600,
        });
    });
});

describe('formatWorkoutSearchSummary', () => {
    it('formats the count and summed distance for multiple matching workouts', () => {
        expect(formatWorkoutSearchSummary([
            { distance: 2000 },
            { distance: 1500 },
        ])).toBe('2 matching workouts · 3.5 km total distance');
    });

    it('recomputes the summary when the resolved result set changes', () => {
        const firstResults = [{ distance: 1000 }, { distance: 500 }];
        const changedResults = [{ distance: 2500 }];

        expect(formatWorkoutSearchSummary(firstResults)).toBe('2 matching workouts · 1.5 km total distance');
        expect(formatWorkoutSearchSummary(changedResults)).toBe('1 matching workout · 2.5 km total distance');
    });

    it('does not render a summary for zero results', () => {
        expect(formatWorkoutSearchSummary([])).toBeNull();
    });
});

describe('createWorkoutSearchController', () => {
    it('clears pending search state, refocuses the input, and invalidates an in-flight response', () => {
        const setQuery = vi.fn();
        const setSearchResults = vi.fn();
        const setSearching = vi.fn();
        const focusSearchInput = vi.fn();
        const clearTimeout = vi.fn();
        const controller = createWorkoutSearchController({
            setQuery,
            setSearchResults,
            setSearching,
            focusSearchInput,
            clearTimeout,
        });
        const inFlightSearch = controller.beginSearch();
        controller.setPendingTimer(123);

        controller.clearSearch();

        expect(setQuery).toHaveBeenCalledWith('');
        expect(setSearchResults).toHaveBeenCalledWith([]);
        expect(setSearching).toHaveBeenCalledWith(false);
        expect(clearTimeout).toHaveBeenCalledOnce();
        expect(focusSearchInput).toHaveBeenCalledOnce();
        expect(controller.isCurrent(inFlightSearch)).toBe(false);
    });
});

describe('manual workout pace', () => {
    it('shows measured work pace rather than elapsed pace for a full interval result', () => {
        const workout = {
            id: 'manual-intervals', date: '2026-09-18', distance: 1000, durationSeconds: 300,
            name: '2x500m', raw_data: { source: 'general_manual_entry', completed_result: {
                activity: 'indoor_row', detailCoverage: 'full', workTimeSeconds: 240,
                segments: [
                    { role: 'work', distanceMeters: 500, durationSeconds: 120 },
                    { role: 'rest', durationSeconds: 60 },
                    { role: 'work', distanceMeters: 500, durationSeconds: 120 },
                ],
            } },
        };
        expect(formatWorkoutPace(workout)).toBe('2:00.0/500m');
    });
    it('uses a kilometre for runs and bike ergs and avoids inventing pace for other activities', () => {
        const manual = (activity: string) => ({
            id: 'workout-1', db_id: 'workout-1', date: '2026-09-18', distance: 5000, durationSeconds: 1500,
            name: 'Manual workout', raw_data: { source: 'general_manual_entry', completed_result: { activity } },
        });
        expect(formatWorkoutPace(manual('run'))).toBe('5:00.0/km');
        expect(formatWorkoutPace(manual('bike_erg'))).toBe('5:00.0/km');
        expect(formatWorkoutPace(manual('other'))).toBe('–');
        expect(formatWorkoutPace(manual('indoor_row'))).toBe('2:30.0/500m');
    });
});

describe('formatAveragePace', () => {
    it('formats a representative average pace from numeric duration seconds and distance', () => {
        expect(formatAveragePace(2000, 480)).toBe('2:00.0/500m');
    });

    it('preserves fractional-second average pace precision', () => {
        expect(formatAveragePace(1000, 245.6)).toBe('2:02.8/500m');
    });

    it('returns a neutral dash when distance or duration is missing', () => {
        expect(formatAveragePace(undefined, 480)).toBe('–');
        expect(formatAveragePace(2000, undefined)).toBe('–');
    });

    it('returns a neutral dash when distance or duration is zero', () => {
        expect(formatAveragePace(0, 480)).toBe('–');
        expect(formatAveragePace(2000, 0)).toBe('–');
    });
});

describe('WorkoutSearchClearButton', () => {
    it('renders a labeled semantic button for native keyboard activation', () => {
        const markup = renderToStaticMarkup(<WorkoutSearchClearButton onClear={vi.fn()} />);

        expect(markup).toContain('<button');
        expect(markup).toContain('type="button"');
        expect(markup).toContain('aria-label="Clear workout search"');
    });
});

describe('RecentWorkouts responsive presentations', () => {
    it('renders every compact mobile workout detail with the same Analyze destination as the desktop row', () => {
        vi.stubGlobal('window', { clearTimeout: vi.fn() });
        const workoutDate = new Date();
        const workout = {
            id: 'mobile-workout-1',
            date: workoutDate.toISOString(),
            distance: 2000,
            time: 4800,
            time_formatted: '8:00.0',
            durationSeconds: 480,
            type: 'rower',
            name: '4 x 500m',
            manual_rwn: '4x500m/2:00r',
        };

        const markup = renderToStaticMarkup(
            <MemoryRouter>
                <RecentWorkouts
                    workouts={[workout]}
                    currentPage={0}
                    hasMore={false}
                    onPageChange={vi.fn()}
                />
            </MemoryRouter>,
        );

        const formattedDate = workoutDate.toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
        });

        expect(markup).toContain('md:hidden');
        expect(markup).toContain('class="hidden md:block"');
        expect(markup).toContain(formattedDate);
        expect(markup.match(/>today</g)).toHaveLength(2);
        expect(markup).toContain('2000m');
        expect(markup).toContain('8:00.0');
        expect(markup).toContain('4 x 500m');
        expect(markup).toContain('RWN: 4x500m/2:00r');
        expect(markup).toContain('href="/workout/mobile-workout-1"');
        expect(markup.match(/href="\/workout\/mobile-workout-1"/g)).toHaveLength(2);
        // The whole mobile row is the link, so it carries its own label rather
        // than repeating a button beside every entry.
        expect(markup).toContain('aria-label="Analyze 4 x 500m"');
        // Pace is the number rowers compare and was missing from the phone view.
        expect(markup).toContain('2:00.0/500m');
    });
});

describe('RecentWorkouts mobile row content', () => {
    const baseWorkout = {
        id: 'row-1',
        date: new Date().toISOString(),
        distance: 1500,
        name: '1500m',
        time: 4800,
        time_formatted: '8:00.0',
        type: 'rower',
    };

    const render = (workout: typeof baseWorkout) => renderToStaticMarkup(
        <MemoryRouter>
            <RecentWorkouts workouts={[workout]} currentPage={0} hasMore={false} onPageChange={vi.fn()} />
        </MemoryRouter>,
    );

    /** Only the phone list, so desktop columns and totals do not skew counts. */
    const mobileSection = (markup: string) => {
        const start = markup.indexOf('md:hidden');
        const end = markup.indexOf('class="hidden md:block"');
        return markup.slice(start, end);
    };

    it('does not repeat the distance when the name already states it', () => {
        vi.stubGlobal('window', { clearTimeout: vi.fn() });
        // A piece named after its distance rendered "1500m" twice in a row that
        // has little space to spare.
        const markup = mobileSection(render({ ...baseWorkout, distance: 1500, name: '1500m' }));
        expect(markup.match(/>1500m</g)).toHaveLength(1);
    });

    it('keeps the distance when it differs from the name', () => {
        vi.stubGlobal('window', { clearTimeout: vi.fn() });
        const markup = mobileSection(render({ ...baseWorkout, distance: 2000, name: '4 x 500m' }));
        expect(markup).toContain('4 x 500m');
        expect(markup).toContain('2000m');
    });
});

describe('RecentWorkouts visible workout count', () => {
    const createWorkout = (id: string, type: string) => ({
        id,
        date: new Date().toISOString(),
        distance: 2000,
        time: 4800,
        time_formatted: '8:00.0',
        durationSeconds: 480,
        type,
        name: `${type} workout`,
    });

    const renderWorkoutList = (workouts: ReturnType<typeof createWorkout>[]) => renderToStaticMarkup(
        <MemoryRouter>
            <RecentWorkouts
                workouts={workouts}
                currentPage={0}
                hasMore={false}
                onPageChange={vi.fn()}
            />
        </MemoryRouter>,
    );

    const countDesktopRows = (markup: string) => (
        markup.match(/<tr class="text-sm hover:bg-neutral-800\/40 transition-colors group">/g) ?? []
    ).length;

    it('keeps the heading count equal to rendered rows before and after a category filter change', () => {
        const workouts = [createWorkout('row-1', 'rower'), createWorkout('bike-1', 'bike')];
        const filteredWorkouts = filterWorkoutsByActivityCategory(workouts, 'Bike');

        const allMarkup = renderWorkoutList(workouts);
        const filteredMarkup = renderWorkoutList(filteredWorkouts);

        expect(allMarkup).toMatch(/Recent Workouts\s*<span[^>]*>\(2\)<\/span>/);
        expect(countDesktopRows(allMarkup)).toBe(2);
        expect(filteredMarkup).toMatch(/Recent Workouts\s*<span[^>]*>\(1\)<\/span>/);
        expect(countDesktopRows(filteredMarkup)).toBe(1);
    });
});

describe('activity-category filtering', () => {
    const workouts = [
        { id: 'row', type: 'rower' },
        { id: 'bike', type: 'bike' },
        { id: 'ski', type: 'skierg' },
        { id: 'run', type: 'run' },
        { id: 'treadmill', type: 'treadmill' },
    ];

    it('normalizes device activity types while preserving generic types', () => {
        expect(workouts.map(getActivityCategory)).toEqual(['Row', 'Bike', 'Ski', 'Run', 'Treadmill']);
    });

    it('filters the active search results and restores all of them', () => {
        const activeSearchResults = [workouts[0], workouts[3], workouts[4]];

        expect(filterWorkoutsByActivityCategory(activeSearchResults, 'Run')).toEqual([workouts[3]]);
        expect(filterWorkoutsByActivityCategory(activeSearchResults, 'All')).toEqual(activeSearchResults);
    });

    it('returns an empty list when the selected category has no active results', () => {
        expect(filterWorkoutsByActivityCategory([workouts[0]], 'Ski')).toEqual([]);
    });
});
