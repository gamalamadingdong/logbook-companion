import { ROWING_12_WEEK_TEMPLATE } from '../data/rowingTrainingBlockTemplate';
import type { TrainingBlockPlan, TrainingBlockPlannedDay } from '../types/trainingBlock.types';

export const TRAINING_BLOCK_ACTIVE_STORAGE_KEY = 'training_block_active_v1';
export const TRAINING_BLOCK_SELECTED_TEMPLATE_STORAGE_KEY = 'training_block_selected_template_v1';

export const TRAINING_BLOCK_PLAN_OPTIONS = [
    {
        id: ROWING_12_WEEK_TEMPLATE.template_id,
        label: '12-week Pete Block',
        description: 'Current integrated rowing block',
        enabled: true,
    },
    {
        id: 'custom_block_preview',
        label: 'Custom block',
        description: 'Coming later',
        enabled: false,
    },
] as const;

export type TrainingBlockPlanOptionId = string;
export type TrainingBlockLifecycleStatus = 'preview' | 'scheduled' | 'active' | 'complete' | 'paused';

const DAY_MS = 24 * 60 * 60 * 1000;

export function readTrainingBlockActive(defaultValue = true): boolean {
    if (typeof window === 'undefined') return defaultValue;
    return window.localStorage.getItem(TRAINING_BLOCK_ACTIVE_STORAGE_KEY) !== 'false';
}

export function writeTrainingBlockActive(value: boolean): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TRAINING_BLOCK_ACTIVE_STORAGE_KEY, value ? 'true' : 'false');
}

export function readSelectedTrainingBlockTemplate(): TrainingBlockPlanOptionId {
    if (typeof window === 'undefined') return ROWING_12_WEEK_TEMPLATE.template_id;

    const stored = window.localStorage.getItem(TRAINING_BLOCK_SELECTED_TEMPLATE_STORAGE_KEY);
    if (stored) return stored;
    return ROWING_12_WEEK_TEMPLATE.template_id;
}

export function writeSelectedTrainingBlockTemplate(value: TrainingBlockPlanOptionId): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TRAINING_BLOCK_SELECTED_TEMPLATE_STORAGE_KEY, value);
}

export function toTrainingBlockLocalDate(dateInput: string | Date): string {
    if (typeof dateInput === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
        }

        const utcMidnightDate = dateInput.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?(?:Z|\+00:00)$/);
        if (utcMidnightDate) {
            return utcMidnightDate[1];
        }
    }

    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
        return typeof dateInput === 'string' ? dateInput.slice(0, 10) : '';
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDay(date: string): number {
    return new Date(`${date}T12:00:00`).getTime();
}

export function getTrainingBlockWeekDaysForDate(
    plan: TrainingBlockPlan,
    dateInput: string | Date = new Date(),
): readonly TrainingBlockPlannedDay[] {
    const date = toTrainingBlockLocalDate(dateInput);
    const day = plan.days.find((entry) => entry.date === date) ?? getNearestTrainingBlockDay(plan, date);
    if (!day) return [];
    return plan.days.filter((entry) => entry.week_number === day.week_number);
}

export function getNearestTrainingBlockDay(plan: TrainingBlockPlan, dateInput: string | Date): TrainingBlockPlannedDay | null {
    const date = toTrainingBlockLocalDate(dateInput);
    const target = parseLocalDay(date);
    if (!Number.isFinite(target) || plan.days.length === 0) return null;

    const planStart = parseLocalDay(plan.start_date);
    const planEnd = parseLocalDay(plan.end_date);
    if (target <= planStart) return plan.days[0];
    if (target >= planEnd) return plan.days[plan.days.length - 1];

    const offset = Math.floor((target - planStart) / DAY_MS);
    return plan.days[Math.min(Math.max(offset, 0), plan.days.length - 1)] ?? null;
}

export function getTrainingBlockLifecycleStatus(
    plan: TrainingBlockPlan,
    dateInput: string | Date = new Date(),
    isActive = true,
): TrainingBlockLifecycleStatus {
    if (!isActive) return 'paused';

    const date = toTrainingBlockLocalDate(dateInput);
    if (date < plan.start_date) return 'preview';
    if (date > plan.end_date) return 'complete';
    return 'active';
}

export function formatTrainingBlockWeekRange(days: readonly TrainingBlockPlannedDay[]): string {
    if (days.length === 0) return '';

    const first = days[0].date;
    const last = days[days.length - 1].date;
    const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });

    return `${format(first)} - ${format(last)}`;
}
