import { describe, it, expect } from 'vitest';

import { formatDistanceMeters, formatKilometerLabel, formatSignedDistanceMeters } from './trainingBlockFormatting';

describe('trainingBlockFormatting', () => {
    it('formats flush meters with single-decimal kilometer precision', () => {
        expect(formatDistanceMeters(4500)).toBe('4.5 km');
        expect(formatDistanceMeters(Number('4500.0000000000001'))).toBe('4.5 km');
    });

    it('falls back to meters under one kilometer', () => {
        expect(formatDistanceMeters(750)).toBe('750 m');
        expect(formatDistanceMeters(0)).toBe('0m');
    });

    it('formats kilometer labels consistently for templates', () => {
        expect(formatKilometerLabel(4500)).toBe('4.5 km');
        expect(formatKilometerLabel(6000)).toBe('6 km');
    });

    it('formats signed deltas with absolute distance formatting', () => {
        expect(formatSignedDistanceMeters(1500)).toBe('+1.5 km');
        expect(formatSignedDistanceMeters(-1500)).toBe('-1.5 km');
        expect(formatSignedDistanceMeters(0)).toBe('0m');
    });
});
