import { describe, expect, it } from 'vitest';
import { literalSearchPattern, normalizeSearchText, rankSearchItems } from './searchUtils';
import type { SearchItem } from './types';
const row = (id: string, title: string, keywords = '', date = ''): SearchItem => ({ id, title, keywords, date, group: 'workouts', subtitle: '', href: `/workout/${id}` });
describe('content search matching', () => {
    it('recognizes notation spacing and multiplication symbols', () => {
        expect(normalizeSearchText(' 4 × 500m ')).toBe(normalizeSearchText('4x500m'));
        expect(rankSearchItems([row('a', '4x500m/1:00r')], '4 × 500m').items).toHaveLength(1);
    });
    it('ranks exact title, title prefix, title words then descriptive matches', () => {
        const rows = [row('description', 'Tuesday', 'steady row'), row('contains', 'Easy steady row'), row('prefix', 'Steady row longer'), row('exact', 'Steady row')];
        expect(rankSearchItems(rows, 'steady row').items.map(r => r.id)).toEqual(['exact', 'prefix', 'contains', 'description']);
    });
    it('requires every term and uses recency for equally relevant workouts', () => {
        const rows = [row('old', 'Intervals', 'speed 500m', '2025-01-01'), row('missing', 'Intervals', 'speed'), row('new', 'Intervals', '500m speed', '2026-01-01')];
        expect(rankSearchItems(rows, 'speed 500m').items.map(r => r.id)).toEqual(['new', 'old']);
    });
    it('bounds each result group and reports truncation', () => {
        const result = rankSearchItems(Array.from({length: 8}, (_, i) => row(String(i), 'Row')), 'row', 6);
        expect(result.items).toHaveLength(6);
        expect(result.hasMore).toBe(true);
    });
    it('treats filter punctuation and wildcard characters as literal search text', () => {
        expect(literalSearchPattern(' 50%_\\,()" ')).toBe('%50\\%\\_\\\\,()"%');
        expect(literalSearchPattern('4 × 500m')).toBe('%4%500m%');
        expect(literalSearchPattern('steady row')).toBe('%steady%row%');
    });
});
