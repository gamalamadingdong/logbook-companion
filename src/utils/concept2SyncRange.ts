export type Concept2SyncRange = 'all' | 'season' | '30days' | 'custom' | 'sinceLastSync';

export interface Concept2SyncRangeOptions {
    range: Concept2SyncRange;
    startDate?: Date | null;
    endDate?: Date | null;
    sinceLastSyncFallbackDays?: number;
    sinceLastSyncOverlapDays?: number;
}

export const LAST_C2_SYNC_TIMESTAMP_KEY = 'last_c2_sync_timestamp';
export const DEFAULT_SINCE_LAST_SYNC_FALLBACK_DAYS = 30;
export const DEFAULT_SINCE_LAST_SYNC_OVERLAP_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatConcept2Date = (date: Date) => date.toISOString().split('T')[0];

export const getConcept2SeasonStart = (now = new Date()) => {
    const currentYear = now.getFullYear();
    const seasonStartYear = now.getMonth() < 4 ? currentYear - 1 : currentYear;
    return `${seasonStartYear}-05-01`;
};

export const parseLastSyncTimestamp = (lastSyncTimestamp: string | null | undefined) => {
    if (!lastSyncTimestamp) return null;

    if (/^\d+$/.test(lastSyncTimestamp)) {
        return Number.parseInt(lastSyncTimestamp, 10);
    }

    const dateTimestamp = Date.parse(lastSyncTimestamp);
    return Number.isFinite(dateTimestamp) ? dateTimestamp : null;
};

export const resolveSinceLastSyncStartDate = (
    now = new Date(),
    lastSyncTimestamp?: string | null,
    fallbackDays = DEFAULT_SINCE_LAST_SYNC_FALLBACK_DAYS,
    overlapDays = DEFAULT_SINCE_LAST_SYNC_OVERLAP_DAYS
) => {
    const parsedLastSync = parseLastSyncTimestamp(lastSyncTimestamp);
    const startTimestamp = parsedLastSync === null
        ? now.getTime() - fallbackDays * DAY_MS
        : parsedLastSync - overlapDays * DAY_MS;

    return new Date(startTimestamp);
};

export const resolveConcept2SyncQueryParams = (
    options: Concept2SyncRangeOptions,
    now = new Date(),
    lastSyncTimestamp?: string | null
) => {
    const queryParams: Record<string, string> = {};

    if (options.range === '30days') {
        queryParams.from = formatConcept2Date(new Date(now.getTime() - 30 * DAY_MS));
    } else if (options.range === 'season') {
        queryParams.from = getConcept2SeasonStart(now);
    } else if (options.range === 'custom' && options.startDate && options.endDate) {
        queryParams.from = formatConcept2Date(options.startDate);
        queryParams.to = formatConcept2Date(options.endDate);
    } else if (options.range === 'sinceLastSync') {
        queryParams.from = formatConcept2Date(resolveSinceLastSyncStartDate(
            now,
            lastSyncTimestamp,
            options.sinceLastSyncFallbackDays,
            options.sinceLastSyncOverlapDays
        ));
    }

    return queryParams;
};
