import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    createWorkoutSearchController,
    filterWorkoutsByActivityCategory,
    formatAveragePace,
    getActivityCategory,
    WorkoutSearchClearButton,
} from './RecentWorkouts';

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
