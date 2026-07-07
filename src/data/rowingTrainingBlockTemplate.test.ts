import { describe, expect, it } from 'vitest';
import { parseRWN } from '@readyall/rwn';

import {
    ROWING_12_WEEK_TEMPLATE,
    WEEK_TARGETS_M,
    buildRowing12WeekPlan,
} from './rowingTrainingBlockTemplate';

describe('rowingTrainingBlockTemplate', () => {
    it('creates a 12-week plan by default', () => {
        expect(ROWING_12_WEEK_TEMPLATE.template_id).toBe('rowing_12_week_2026_v1');
        expect(ROWING_12_WEEK_TEMPLATE.duration_weeks).toBe(12);
        expect(ROWING_12_WEEK_TEMPLATE.days).toHaveLength(84);
        expect(ROWING_12_WEEK_TEMPLATE.start_date).toBe('2026-07-06');
    });

    it('maps monday/thu sessions to the expected first few weeks', () => {
        const plan = buildRowing12WeekPlan();

        expect(plan.days[0].sessions[0].family).toBe('mon_8x500');
        expect(plan.days[3].sessions[0].family).toBe('thu_5x1500');

        expect(plan.days[7].sessions[0].family).toBe('mon_pyramid_250_500_750_1000_750_500_250');
        expect(plan.days[10].sessions[0].family).toBe('thu_4x2000');

        expect(plan.days[14].sessions[0].family).toBe('mon_4x1000');
        expect(plan.days[17].sessions[0].family).toBe('thu_3000_2500_2000');
    });

    it('uses the special week 4 and week 12 flush profiles', () => {
        const plan = buildRowing12WeekPlan();
        const week4Thursday = plan.days[24];
        const week12Monday = plan.days[77];
        const week12Thursday = plan.days[80];

        const week4Flush = week4Thursday.sessions.find((session) => session.family.startsWith('flush'));
        const week12MondayFlush = week12Monday.sessions.find((session) => session.family.startsWith('flush'));
        const week12ThursdayFlush = week12Thursday.sessions.find((session) => session.family.startsWith('flush'));

        expect(week4Flush?.expected_distance_meters).toBe(3000);
        expect(week12MondayFlush?.expected_distance_meters).toBe(6000);
        expect(week12ThursdayFlush?.expected_distance_meters).toBe(6000);
    });

    it('stores parseable RWN values for key pete plan sessions', () => {
        const plan = buildRowing12WeekPlan();

        const keySessions = [
            plan.days[0].sessions[0],
            plan.days[3].sessions[0],
            plan.days[7].sessions[0],
            plan.days[10].sessions[0],
            plan.days[21].sessions[0],
            plan.days[24].sessions[0],
            plan.days[77].sessions[0],
            plan.days[80].sessions[0],
        ];

        for (const session of keySessions) {
            expect(session.planned_rwn).toBeDefined();
            expect(session.planned_rwn?.length).toBeGreaterThan(0);
            expect(parseRWN(session.planned_rwn!)).not.toBeNull();
        }
    });

    it('stores parseable RWN only for canonical erg and cross-training sessions', () => {
        const plan = buildRowing12WeekPlan();
        const sessions = plan.days.flatMap((day) => day.sessions);
        const rwnSessions = sessions.filter((session) => session.planned_rwn);
        const strengthSessions = sessions.filter((session) => session.source === 'strength');

        expect(rwnSessions.length).toBeGreaterThan(0);
        expect(strengthSessions.length).toBeGreaterThan(0);

        for (const session of rwnSessions) {
            expect(parseRWN(session.planned_rwn!)).not.toBeNull();
        }

        for (const session of strengthSessions) {
            expect(session.planned_rwn).toBeUndefined();
            expect(session.support_prescription?.kind).toBe('strength');
            expect(session.support_prescription?.exercises?.length).toBeGreaterThan(0);
        }
    });

    it('uses Cross RWN for generic aerobic cross-training', () => {
        const plan = buildRowing12WeekPlan();
        const crossSession = plan.days[2].sessions.find((session) => session.source === 'cross_training');

        expect(crossSession?.planned_rwn).toBe('Cross: 60:00');
        const parsed = parseRWN(crossSession!.planned_rwn!);
        expect(parsed?.modality).toBe('cross');
    });

    it('aligns day category and weekly target assignments', () => {
        const plan = buildRowing12WeekPlan();
        expect(plan.days[0].category).toBe('erg');
        expect(plan.days[1].category).toBe('erg');
        expect(plan.days[2].category).toBe('cross_training');
        expect(plan.days[6].category).toBe('rest');

        expect(plan.days[0].target_distance_meters).toBe(WEEK_TARGETS_M[0].target_distance_meters);
        expect(plan.days[6].target_distance_meters).toBe(WEEK_TARGETS_M[0].target_distance_meters);
        expect(plan.days[7].target_distance_meters).toBe(WEEK_TARGETS_M[1].target_distance_meters);
    });

    it('attaches pull reference to Mon/Thu and push reference to Wed/Sat', () => {
        const plan = buildRowing12WeekPlan();

        expect(plan.days[0].reference?.routines[0].kind).toBe('pull');
        expect(plan.days[3].reference?.routines[0].kind).toBe('pull');
        expect(plan.days[2].reference?.routines[0].kind).toBe('push');
        expect(plan.days[5].reference?.routines[0].kind).toBe('push');
        expect(plan.days[6].reference).toBeUndefined();
    });
});
