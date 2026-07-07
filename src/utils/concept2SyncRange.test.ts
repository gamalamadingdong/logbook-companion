import { describe, expect, it } from 'vitest';
import {
    formatConcept2Date,
    getConcept2SeasonStart,
    parseLastSyncTimestamp,
    resolveConcept2SyncQueryParams,
    resolveSinceLastSyncStartDate,
} from './concept2SyncRange';

describe('concept2SyncRange', () => {
    const now = new Date('2026-07-07T12:00:00.000Z');

    it('resolves the last 30 days range', () => {
        expect(resolveConcept2SyncQueryParams({ range: '30days' }, now)).toEqual({
            from: '2026-06-07',
        });
    });

    it('resolves the current Concept2 season start', () => {
        expect(getConcept2SeasonStart(new Date('2026-07-07T12:00:00.000Z'))).toBe('2026-05-01');
        expect(getConcept2SeasonStart(new Date('2026-03-07T12:00:00.000Z'))).toBe('2025-05-01');
    });

    it('resolves custom date ranges', () => {
        expect(resolveConcept2SyncQueryParams({
            range: 'custom',
            startDate: new Date('2026-06-01T04:00:00.000Z'),
            endDate: new Date('2026-06-14T04:00:00.000Z'),
        }, now)).toEqual({
            from: '2026-06-01',
            to: '2026-06-14',
        });
    });

    it('resolves since-last-sync with a one-day overlap', () => {
        const lastSync = new Date('2026-07-06T12:00:00.000Z').getTime().toString();

        expect(resolveConcept2SyncQueryParams({
            range: 'sinceLastSync',
        }, now, lastSync)).toEqual({
            from: '2026-07-05',
        });
    });

    it('falls back to thirty days when since-last-sync has no timestamp', () => {
        expect(resolveConcept2SyncQueryParams({
            range: 'sinceLastSync',
        }, now, null)).toEqual({
            from: '2026-06-07',
        });
    });

    it('allows the since-last-sync fallback and overlap to be tuned', () => {
        const lastSync = new Date('2026-07-06T12:00:00.000Z').getTime().toString();

        expect(formatConcept2Date(resolveSinceLastSyncStartDate(now, lastSync, 14, 2))).toBe('2026-07-04');
        expect(resolveConcept2SyncQueryParams({
            range: 'sinceLastSync',
            sinceLastSyncFallbackDays: 14,
        }, now, null)).toEqual({
            from: '2026-06-23',
        });
    });

    it('parses numeric and ISO timestamps', () => {
        expect(parseLastSyncTimestamp('1783425600000')).toBe(1783425600000);
        expect(parseLastSyncTimestamp('2026-07-07T12:00:00.000Z')).toBe(1783425600000);
        expect(parseLastSyncTimestamp('not-a-date')).toBeNull();
    });

    it('leaves all-time sync unbounded', () => {
        expect(resolveConcept2SyncQueryParams({ range: 'all' }, now)).toEqual({});
    });
});
