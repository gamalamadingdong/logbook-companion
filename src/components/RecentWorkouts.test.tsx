import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createWorkoutSearchController, WorkoutSearchClearButton } from './RecentWorkouts';

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

describe('WorkoutSearchClearButton', () => {
    it('renders a labeled semantic button for native keyboard activation', () => {
        const markup = renderToStaticMarkup(<WorkoutSearchClearButton onClear={vi.fn()} />);

        expect(markup).toContain('<button');
        expect(markup).toContain('type="button"');
        expect(markup).toContain('aria-label="Clear workout search"');
    });
});
