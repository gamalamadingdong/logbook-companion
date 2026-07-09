import { describe, expect, it } from 'vitest';

import { ROWING_12_WEEK_TEMPLATE } from '../data/rowingTrainingBlockTemplate';
import type { Json } from '../types/database.types';
import type { TrainingBlockPlan, TrainingBlockPlannedDay, TrainingBlockPlannedSession } from '../types/trainingBlock.types';
import {
    templateRowsToTrainingBlockPlan,
    type TrainingBlockTemplateDayRow,
    type TrainingBlockTemplateRow,
    type TrainingBlockTemplateSessionRow,
} from './trainingBlockService';

function toJson(value: unknown): Json {
    return JSON.parse(JSON.stringify(value)) as Json;
}

function buildPersistedSnapshotFromPlan(plan: TrainingBlockPlan): {
    template: TrainingBlockTemplateRow;
    days: TrainingBlockTemplateDayRow[];
    sessions: TrainingBlockTemplateSessionRow[];
} {
    const template: TrainingBlockTemplateRow = {
        id: 'template-rowing-12-week',
        template_key: plan.template_id,
        name: '12-week Pete Block',
        description: null,
        version: 1,
        status: 'published',
        source: 'logbook_companion',
        duration_weeks: plan.duration_weeks,
        default_start_date: plan.start_date,
        metadata: { source: 'rowingTrainingBlockTemplate.ts' },
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
    };

    const days: TrainingBlockTemplateDayRow[] = plan.days.map((day, index) => ({
        id: `day-${index + 1}`,
        template_id: template.id,
        week_number: day.week_number,
        day_slot: day.day_slot,
        day_of_week: day.day_of_week,
        category: day.category,
        planned_distance_meters: day.planned_distance_meters,
        target_distance_meters: day.target_distance_meters,
        reference: day.reference ? toJson(day.reference) : null,
        metadata: { source: 'rowingTrainingBlockTemplate.ts' },
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
    }));

    const sessions: TrainingBlockTemplateSessionRow[] = plan.days.flatMap((day, dayIndex) => (
        day.sessions.map((session, sessionIndex) => ({
            id: `session-${dayIndex + 1}-${sessionIndex + 1}`,
            template_day_id: days[dayIndex].id,
            session_key: session.id,
            title: session.title,
            planned_rwn: session.planned_rwn ?? null,
            workout_template_id: session.workout_template_id ?? null,
            support_prescription: session.support_prescription ? toJson(session.support_prescription) : null,
            support_session_template_id: session.support_session_template_id ?? null,
            family: session.family,
            role: session.role,
            source: session.source,
            expected_distance_meters: session.expected_distance_meters ?? null,
            expected_duration_minutes: session.expected_duration_minutes ?? null,
            target_split_seconds_per_500m: session.target_split_seconds_per_500m ?? null,
            intervals: session.intervals ? toJson(session.intervals) : null,
            instructions: session.instructions ? [...session.instructions] : null,
            counts_toward_weekly_volume: session.counts_toward_weekly_volume ?? false,
            is_key_session: session.is_key_session ?? false,
            sort_order: sessionIndex + 1,
            metadata: { source: 'rowingTrainingBlockTemplate.ts' },
            created_at: '2026-07-07T00:00:00Z',
            updated_at: '2026-07-07T00:00:00Z',
        }))
    ));

    return { template, days, sessions };
}

function comparableDay(day: TrainingBlockPlannedDay) {
    return {
        date: day.date,
        week_number: day.week_number,
        day_of_week: day.day_of_week,
        weekday_index: day.weekday_index,
        day_slot: day.day_slot,
        category: day.category,
        planned_distance_meters: day.planned_distance_meters,
        target_distance_meters: day.target_distance_meters,
        reference: day.reference,
        sessions: day.sessions.map(comparableSession),
    };
}

function comparableSession(session: TrainingBlockPlannedSession) {
    return {
        id: session.id,
        title: session.title,
        planned_rwn: session.planned_rwn,
        support_prescription: session.support_prescription,
        family: session.family,
        role: session.role,
        source: session.source,
        expected_distance_meters: session.expected_distance_meters,
        expected_duration_minutes: session.expected_duration_minutes,
        target_split_seconds_per_500m: session.target_split_seconds_per_500m,
        intervals: session.intervals,
        instructions: session.instructions,
        counts_toward_weekly_volume: session.counts_toward_weekly_volume,
        is_key_session: session.is_key_session,
    };
}

describe('training block persisted template parity', () => {
    it('maps the persisted 12-week template snapshot back to the static template shape', () => {
        const persistedPlan = templateRowsToTrainingBlockPlan(
            buildPersistedSnapshotFromPlan(ROWING_12_WEEK_TEMPLATE),
            ROWING_12_WEEK_TEMPLATE.start_date,
        );

        expect(persistedPlan.template_id).toBe(ROWING_12_WEEK_TEMPLATE.template_id);
        expect(persistedPlan.start_date).toBe(ROWING_12_WEEK_TEMPLATE.start_date);
        expect(persistedPlan.end_date).toBe(ROWING_12_WEEK_TEMPLATE.end_date);
        expect(persistedPlan.duration_weeks).toBe(ROWING_12_WEEK_TEMPLATE.duration_weeks);
        expect(persistedPlan.days).toHaveLength(84);
        expect(persistedPlan.days.map(comparableDay)).toEqual(
            ROWING_12_WEEK_TEMPLATE.days.map(comparableDay),
        );
    });
});
