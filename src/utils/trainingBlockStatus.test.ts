import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { buildRowing12WeekPlan } from '../data/rowingTrainingBlockTemplate';
import {
    TRAINING_BLOCK_ACTIVE_STORAGE_KEY,
    formatTrainingBlockWeekRange,
    getNearestTrainingBlockDay,
    getTrainingBlockLifecycleStatus,
    getTrainingBlockWeekDaysForDate,
    readTrainingBlockActive,
    writeTrainingBlockActive,
} from './trainingBlockStatus';

const plan = buildRowing12WeekPlan();
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        clear: () => { store = {}; },
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
    };
})();

describe('trainingBlockStatus', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'window', {
            value: { localStorage: localStorageMock },
            configurable: true,
        });
        localStorageMock.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-06T12:00:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorageMock.clear();
        Reflect.deleteProperty(globalThis, 'window');
    });

    it('reads active state from local storage with active as the default', () => {
        expect(readTrainingBlockActive()).toBe(true);

        writeTrainingBlockActive(false);
        expect(localStorageMock.getItem(TRAINING_BLOCK_ACTIVE_STORAGE_KEY)).toBe('false');
        expect(readTrainingBlockActive()).toBe(false);

        writeTrainingBlockActive(true);
        expect(readTrainingBlockActive()).toBe(true);
    });

    it('finds the nearest plan day and week days for a date inside the block', () => {
        const day = getNearestTrainingBlockDay(plan, '2026-07-08');
        const weekDays = getTrainingBlockWeekDaysForDate(plan, '2026-07-08');

        expect(day?.week_number).toBe(1);
        expect(day?.day_slot).toBe(2);
        expect(weekDays).toHaveLength(7);
        expect(formatTrainingBlockWeekRange(weekDays)).toBe('Jul 6 - Jul 12');
    });

    it('reports lifecycle status without persisting a schema-backed plan', () => {
        expect(getTrainingBlockLifecycleStatus(plan, '2026-07-01', true)).toBe('preview');
        expect(getTrainingBlockLifecycleStatus(plan, '2026-07-06', true)).toBe('active');
        expect(getTrainingBlockLifecycleStatus(plan, '2026-10-01', true)).toBe('complete');
        expect(getTrainingBlockLifecycleStatus(plan, '2026-07-06', false)).toBe('inactive');
    });
});
