import type { SearchGroupResult, SearchItem } from './types';

export const SEARCH_GROUP_LIMIT = 6;
export const SEARCH_CANDIDATE_LIMIT = 60;
export function normalizeSearchText(value: string): string {
    return value.normalize('NFKC').toLowerCase().replace(/(\d)\s*[x×]\s*(?=\d)/g, '$1x').replace(/\s+/g, ' ').trim();
}

/** Raw LIKE value; quote with JSON.stringify when embedding in a PostgREST OR. */
export function literalSearchPattern(value: string): string {
    const escaped = value.trim().replace(/[\\%_]/g, '\\$&');
    return `%${escaped.replace(/(\d)\s*[x×]\s*(?=\d)/gi, '$1%').replace(/\s+/g, '%')}%`;
}

export function rankSearchItems(items: SearchItem[], query: string, limit = SEARCH_GROUP_LIMIT): SearchGroupResult {
    const normalized = normalizeSearchText(query);
    if (!normalized) return { items: [], hasMore: false };
    const terms = normalized.split(' ');
    const score = (item: SearchItem) => {
        const title = normalizeSearchText(item.title);
        const keywords = normalizeSearchText(item.keywords ?? '');
        const haystack = `${title} ${keywords} ${normalizeSearchText(item.subtitle)}`;
        if (!terms.every(term => haystack.includes(term))) return 0;
        if (title === normalized) return 5;
        if (title.startsWith(normalized)) return 4;
        if (title.includes(normalized)) return 3;
        if (terms.every(term => title.includes(term))) return 2;
        return 1;
    };
    const ranked = items.map(item => ({item, score: score(item)})).filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score || (b.item.date ?? '').localeCompare(a.item.date ?? '') || a.item.title.localeCompare(b.item.title));
    return {items: ranked.slice(0, limit).map(entry => entry.item), hasMore: ranked.length > limit};
}

/** AND between words, OR across fields: words may occur in different fields/order. */
export function applySearchTerms<T extends { or: (filters: string) => T }>(builder: T, fields: readonly string[], query: string): T {
    for (const term of normalizeSearchText(query).split(' ').filter(Boolean).slice(0, 12)) {
        const pattern = JSON.stringify(literalSearchPattern(term));
        builder = builder.or(fields.map(field => `${field}.ilike.${pattern}`).join(','));
    }
    return builder;
}
