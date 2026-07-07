import { describe, expect, it } from 'vitest';
import { buildRowing12WeekPlan } from '../data/rowingTrainingBlockTemplate';
import type { TrainingBlockPlan } from '../types/trainingBlock.types';
import { validateTrainingBlockTemplate } from './trainingBlockTemplateValidation';

function clonePlan(): TrainingBlockPlan {
    return JSON.parse(JSON.stringify(buildRowing12WeekPlan())) as TrainingBlockPlan;
}

describe('validateTrainingBlockTemplate', () => {
    it('summarizes the seeded rowing block without structural errors', () => {
        const health = validateTrainingBlockTemplate(buildRowing12WeekPlan(), { source: 'static' });

        expect(health.source).toBe('static');
        expect(health.total_days).toBe(84);
        expect(health.expected_days).toBe(84);
        expect(health.total_sessions).toBeGreaterThan(0);
        expect(health.rwn_session_count).toBeGreaterThan(0);
        expect(health.support_session_count).toBeGreaterThan(0);
        expect(health.error_count).toBe(0);
        expect(health.issues.filter((issue) => issue.code === 'invalid_rwn')).toHaveLength(0);
    });

    it('reports duplicate session ids and invalid RWN', () => {
        const plan = clonePlan();
        const firstDay = plan.days[0];
        const duplicate = { ...firstDay.sessions[0], planned_rwn: 'not-valid-rwn' };
        const brokenPlan: TrainingBlockPlan = {
            ...plan,
            days: plan.days.map((day, index) => index === 0
                ? { ...day, sessions: [...day.sessions, duplicate] }
                : day),
        };

        const health = validateTrainingBlockTemplate(brokenPlan);

        expect(health.error_count).toBeGreaterThanOrEqual(2);
        expect(health.issues.some((issue) => issue.code === 'duplicate_session_id')).toBe(true);
        expect(health.issues.some((issue) => issue.code === 'invalid_rwn')).toBe(true);
    });

    it('flags block-local erg sessions that are missing planned RWN', () => {
        const plan = clonePlan();
        const day = plan.days.find((entry) => entry.sessions.some((session) => session.source === 'erg'))!;
        const session = day.sessions.find((entry) => entry.source === 'erg')!;
        const brokenPlan: TrainingBlockPlan = {
            ...plan,
            days: plan.days.map((entry) => entry.date === day.date
                ? {
                    ...entry,
                    sessions: entry.sessions.map((candidate) => candidate.id === session.id
                        ? { ...candidate, planned_rwn: undefined, workout_template_id: null }
                        : candidate),
                }
                : entry),
        };

        const health = validateTrainingBlockTemplate(brokenPlan);

        expect(health.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'warning',
                code: 'missing_rwn',
                session_id: session.id,
            }),
        ]));
    });

    it('flags support sessions without structured support prescriptions', () => {
        const plan = clonePlan();
        const day = plan.days.find((entry) => entry.sessions.some((session) => session.source === 'strength'))!;
        const session = day.sessions.find((entry) => entry.source === 'strength')!;
        const brokenPlan: TrainingBlockPlan = {
            ...plan,
            days: plan.days.map((entry) => entry.date === day.date
                ? {
                    ...entry,
                    sessions: entry.sessions.map((candidate) => candidate.id === session.id
                        ? { ...candidate, support_prescription: undefined }
                        : candidate),
                }
                : entry),
        };

        const health = validateTrainingBlockTemplate(brokenPlan);

        expect(health.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'warning',
                code: 'missing_support_prescription',
                session_id: session.id,
            }),
        ]));
    });

    it('summarizes linked workout template RWN sources', () => {
        const plan = clonePlan();
        const day = plan.days.find((entry) => entry.sessions.some((session) => session.source === 'erg'))!;
        const session = day.sessions.find((entry) => entry.source === 'erg')!;
        const linkedPlan: TrainingBlockPlan = {
            ...plan,
            days: plan.days.map((entry) => entry.date === day.date
                ? {
                    ...entry,
                    sessions: entry.sessions.map((candidate) => candidate.id === session.id
                        ? { ...candidate, workout_template_id: 'library-1' }
                        : candidate),
                }
                : entry),
        };

        const health = validateTrainingBlockTemplate(linkedPlan, {
            linkedWorkoutTemplatesById: new Map([
                ['library-1', { id: 'library-1', name: '8 x 500m', rwn: session.planned_rwn ?? null }],
            ]),
        });

        expect(health.library_linked_sessions).toBe(1);
        expect(health.linked_sessions_with_library_rwn).toBe(1);
        expect(health.linked_sessions_with_block_rwn).toBe(1);
        expect(health.linked_sessions_with_rwn_mismatch).toBe(0);
        expect(health.missing_linked_template_count).toBe(0);
    });

    it('flags missing linked workout templates and linked RWN mismatches', () => {
        const plan = clonePlan();
        const day = plan.days.find((entry) => entry.sessions.filter((session) => session.source === 'erg').length > 0)!;
        const session = day.sessions.find((entry) => entry.source === 'erg')!;
        const missingId = 'missing-library-template';
        const brokenPlan: TrainingBlockPlan = {
            ...plan,
            days: plan.days.map((entry) => entry.date === day.date
                ? {
                    ...entry,
                    sessions: entry.sessions.map((candidate) => candidate.id === session.id
                        ? { ...candidate, workout_template_id: missingId }
                        : candidate),
                }
                : entry),
        };

        const missingHealth = validateTrainingBlockTemplate(brokenPlan, {
            linkedWorkoutTemplatesById: new Map(),
        });

        expect(missingHealth.missing_linked_template_count).toBe(1);
        expect(missingHealth.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'missing_linked_workout_template', severity: 'error' }),
        ]));

        const mismatchHealth = validateTrainingBlockTemplate(brokenPlan, {
            linkedWorkoutTemplatesById: new Map([
                [missingId, { id: missingId, name: 'Different library workout', rwn: '4x1000m/5:00r' }],
            ]),
        });

        expect(mismatchHealth.linked_sessions_with_rwn_mismatch).toBe(1);
        expect(mismatchHealth.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'linked_rwn_mismatch', severity: 'warning' }),
        ]));
    });

    it('flags linked workout templates without RWN', () => {
        const plan = clonePlan();
        const day = plan.days.find((entry) => entry.sessions.some((session) => session.source === 'erg'))!;
        const session = day.sessions.find((entry) => entry.source === 'erg')!;
        const linkedPlan: TrainingBlockPlan = {
            ...plan,
            days: plan.days.map((entry) => entry.date === day.date
                ? {
                    ...entry,
                    sessions: entry.sessions.map((candidate) => candidate.id === session.id
                        ? { ...candidate, workout_template_id: 'library-no-rwn' }
                        : candidate),
                }
                : entry),
        };

        const health = validateTrainingBlockTemplate(linkedPlan, {
            linkedWorkoutTemplatesById: new Map([
                ['library-no-rwn', { id: 'library-no-rwn', name: 'Library without RWN', rwn: null }],
            ]),
        });

        expect(health.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'linked_template_missing_rwn', severity: 'warning' }),
        ]));
    });

});
