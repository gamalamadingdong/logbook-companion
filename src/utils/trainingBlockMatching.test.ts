import { describe, expect, it } from 'vitest';

import { buildRowing12WeekPlan } from '../data/rowingTrainingBlockTemplate';
import { scoreAssignmentAgainstPlanDay, scoreAssignmentAgainstPlanWeek } from './trainingBlockMatching';

const plan = buildRowing12WeekPlan();

describe('trainingBlockMatching', () => {
    it('satisfies a planned rowing session on exact RWN match', () => {
        const monday = plan.days[0];
        const match = scoreAssignmentAgainstPlanDay(monday, {
            id: 'a1',
            scheduled_date: monday.date,
            canonical_name: '8x500m/3:30r',
            title: '8x500',
        });

        expect(match.relationship).toBe('satisfies');
        expect(match.planned_session_id).toBe('mon_8x500-primary');
        expect(match.confidence).toBeGreaterThan(0.9);
    });

    it('allows specific bike/run/ski assignments to satisfy generic Cross prescriptions', () => {
        const wednesday = plan.days[2];
        const match = scoreAssignmentAgainstPlanDay(wednesday, {
            id: 'a2',
            scheduled_date: wednesday.date,
            canonical_name: 'Bike: 60:00',
            title: 'Bike cross training',
        });

        expect(match.relationship).toBe('satisfies');
        expect(match.planned_session_title).toBe('Cross-training 60 min');
    });

    it('treats strength assignments as support-only instead of canonical RWN matches', () => {
        const wednesday = plan.days[2];
        const match = scoreAssignmentAgainstPlanDay(wednesday, {
            id: 'a3',
            scheduled_date: wednesday.date,
            title: 'Push strength lift',
            workout_type: 'strength',
        });

        expect(match.relationship).toBe('support_only');
        expect(match.planned_session_title).toBe('Strength (push)');
    });

    it('marks unrelated rowing assignment as a modification rather than exact satisfaction', () => {
        const monday = plan.days[0];
        const match = scoreAssignmentAgainstPlanDay(monday, {
            id: 'a4',
            scheduled_date: monday.date,
            canonical_name: '4x1000m/5:00r',
            title: 'Different intervals',
        });

        expect(match.relationship).toBe('modifies');
        expect(match.confidence).toBeLessThan(0.9);
    });

    it('prefers manual RWN when matching manual workout logs', () => {
        const monday = plan.days[0];
        const match = scoreAssignmentAgainstPlanDay(monday, {
            id: 'manual-1',
            scheduled_date: monday.date,
            title: 'Manual row entry',
            canonical_name: 'Just Row',
            manual_rwn: '8x500m/3:30r',
            workout_type: 'manual',
            source: 'manual',
        });

        expect(match.relationship).toBe('satisfies');
        expect(match.planned_session_id).toBe('mon_8x500-primary');
    });

    it('uses simple distance fallback for steady Concept2 logs without canonical names', () => {
        const tuesday = plan.days[1];
        const match = scoreAssignmentAgainstPlanDay(tuesday, {
            id: 'c2-plain-distance',
            scheduled_date: tuesday.date,
            title: 'FixedDistanceSplits',
            workout_type: 'FixedDistanceSplits',
            source: 'concept2',
            distance_meters: 8000,
        });

        expect(match.relationship).toBe('satisfies');
        expect(match.planned_session_title).toBe('Steady 8k');
    });

    it('uses the same canonical signature concept as library history matching', () => {
        const plan = buildRowing12WeekPlan();
        const week4Monday = plan.days[21];
        const match = scoreAssignmentAgainstPlanDay(week4Monday, {
            id: 'thirty-rate-cap-log',
            scheduled_date: week4Monday.date,
            canonical_name: '30:00',
            title: '30 minute row',
            source: 'concept2',
            distance_meters: 7500,
            duration_seconds: 1800,
        });

        expect(week4Monday.sessions[0].planned_rwn).toBe('30:00@r20');
        expect(match.relationship).toBe('satisfies');
        expect(match.planned_session_id).toBe('mon_30r20-primary');
        expect(match.confidence).toBeGreaterThan(0.9);
        expect(match.reason).toContain('canonical signature');
    });


    it('uses direct workout-library template links when planned and logged workouts share a template id', () => {
        const monday = {
            ...plan.days[0],
            sessions: plan.days[0].sessions.map((session, index) => index === 0
                ? { ...session, workout_template_id: 'library-template-1' }
                : session),
        };
        const match = scoreAssignmentAgainstPlanDay(monday, {
            id: 'logged-template-match',
            scheduled_date: monday.date,
            title: 'Concept2 imported workout',
            template_id: 'library-template-1',
            canonical_name: 'Just Row',
        });

        expect(match.relationship).toBe('satisfies');
        expect(match.planned_session_id).toBe('mon_8x500-primary');
        expect(match.confidence).toBe(0.99);
        expect(match.reason).toContain('workout-library template');
    });


    it('finds the best assignment match within the selected training week', () => {
        const monday = plan.days[0];
        const tuesday = plan.days[1];
        const weekDays = plan.days.filter((day) => day.week_number === 1);
        const match = scoreAssignmentAgainstPlanWeek(weekDays, {
            id: 'shifted-assignment',
            scheduled_date: tuesday.date,
            canonical_name: '8x500m/3:30r',
            title: 'Shifted intervals',
        });

        expect(match?.planned_day.date).toBe(monday.date);
        expect(match?.match.relationship).toBe('satisfies');
        expect(match?.match.planned_session_id).toBe('mon_8x500-primary');
    });

});
