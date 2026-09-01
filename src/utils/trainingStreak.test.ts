import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeStreak } from './trainingStreak';

const toLocalDateString = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const daysFrom = (date: Date, offset: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + offset);
    return result;
};

const workoutOn = (date: Date) => ({ completed_at: date.toISOString() });

describe('computeStreak', () => {
    const now = new Date();

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns no streak or workout date when there are no workouts', () => {
        vi.useFakeTimers();
        vi.setSystemTime(now);

        expect(computeStreak([])).toEqual({ streak: 0, lastWorkoutDate: null });
    });

    it('counts a workout completed today as a one-day streak', () => {
        vi.useFakeTimers();
        vi.setSystemTime(now);

        const result = computeStreak([workoutOn(now)]);

        expect(result.streak).toBe(1);
        expect(result.lastWorkoutDate && toLocalDateString(result.lastWorkoutDate)).toBe(toLocalDateString(now));
    });

    it('counts consecutive unique workout days through today', () => {
        vi.useFakeTimers();
        vi.setSystemTime(now);

        const result = computeStreak([
            workoutOn(now),
            workoutOn(now),
            workoutOn(daysFrom(now, -1)),
            workoutOn(daysFrom(now, -2)),
        ]);

        expect(result.streak).toBe(3);
        expect(result.lastWorkoutDate && toLocalDateString(result.lastWorkoutDate)).toBe(toLocalDateString(now));
    });

    it('returns a zero streak but preserves the latest date when the workouts are no longer current', () => {
        vi.useFakeTimers();
        vi.setSystemTime(now);

        const lastWorkout = daysFrom(now, -2);
        const result = computeStreak([workoutOn(lastWorkout), workoutOn(daysFrom(now, -3))]);

        expect(result.streak).toBe(0);
        expect(result.lastWorkoutDate && toLocalDateString(result.lastWorkoutDate)).toBe(toLocalDateString(lastWorkout));
    });
});
