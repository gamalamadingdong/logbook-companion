import { describe, expect, it } from 'vitest';
import {
    findLinkedPersonalEnrollment,
    parseSupportTemplateSearchLink,
    parseTrainingBlockSearchLink,
    resolveLinkedPlanDay,
} from './searchLinks';

const enrollmentId = '12345678-1234-1234-1234-123456789abc';

describe('training block search links', () => {
    it('preserves a valid enrollment, calendar date and session key', () => {
        expect(parseTrainingBlockSearchLink(`?enrollment=${enrollmentId}&date=2026-11-16&session=mon-primary`)).toEqual({
            enrollmentId, date: '2026-11-16', sessionId: 'mon-primary', invalid: false,
        });
    });

    it('rejects impossible dates and malformed record identifiers', () => {
        expect(parseTrainingBlockSearchLink('?enrollment=other&date=2026-02-30&session=%3Cscript%3E')).toEqual({
            enrollmentId: null, date: null, sessionId: null, invalid: true,
        });
    });

    it('only selects a linked enrollment owned by the current user and in personal scope', () => {
        const link = parseTrainingBlockSearchLink(`?enrollment=${enrollmentId}`);
        const owned = { id: enrollmentId, user_id: 'me', team_id: null, org_id: null };
        expect(findLinkedPersonalEnrollment(link, 'me', [owned])).toBe(owned);
        expect(findLinkedPersonalEnrollment(link, 'someone-else', [owned])).toBeNull();
        expect(findLinkedPersonalEnrollment(link, 'me', [{ ...owned, team_id: 'team' }])).toBeNull();
        expect(findLinkedPersonalEnrollment(link, 'me', [{ ...owned, org_id: 'org' }])).toBeNull();
    });

    it('selects the requested day and matching session rather than today', () => {
        const link = parseTrainingBlockSearchLink(`?enrollment=${enrollmentId}&date=2026-11-16&session=mon-primary`);
        const days = [{ date: '2026-11-16', sessions: [{ id: 'mon-primary' }] }];
        expect(resolveLinkedPlanDay(link, days)).toEqual({ date: '2026-11-16', sessionId: 'mon-primary', error: null });
    });

    it('does not substitute another day or session for an unavailable search target', () => {
        const days = [{ date: '2026-11-16', sessions: [{ id: 'mon-primary' }] }];
        expect(resolveLinkedPlanDay(parseTrainingBlockSearchLink('?date=2026-11-17'), days)).toMatchObject({ date: null, sessionId: null, error: expect.any(String) });
        expect(resolveLinkedPlanDay(parseTrainingBlockSearchLink('?date=2026-11-16&session=missing'), days)).toMatchObject({ date: '2026-11-16', sessionId: null, error: expect.any(String) });
    });
});

describe('support template search links', () => {
    it('accepts a template UUID and rejects arbitrary text', () => {
        expect(parseSupportTemplateSearchLink(`?template=${enrollmentId}`)).toEqual({ templateId: enrollmentId, invalid: false });
        expect(parseSupportTemplateSearchLink('?template=missing')).toEqual({ templateId: null, invalid: true });
        expect(parseSupportTemplateSearchLink('')).toEqual({ templateId: null, invalid: false });
    });
});
