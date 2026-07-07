import { describe, it, expect } from 'vitest';
import { parseRWN } from '../parser';
import { structureToRWN } from '../serializer';

/**
 * Round-trip tests: parse → serialize → parse
 * The serialized output should re-parse to an equivalent structure.
 *
 * NOTE: These tests document current serializer behavior; round-trip
 * fidelity will improve as the serializer matures.
 */

describe('structureToRWN', () => {
    describe('steady state', () => {
        it('serializes distance steady state', () => {
            const rwn = '5000m';
            const structure = parseRWN(rwn);
            expect(structure).not.toBeNull();
            const serialized = structureToRWN(structure!);
            expect(serialized).toBe('5000m');
        });

        it('serializes time steady state', () => {
            const rwn = '30:00';
            const structure = parseRWN(rwn);
            expect(structure).not.toBeNull();
            const serialized = structureToRWN(structure!);
            expect(serialized).toBe('30:00');
        });

        it('serializes cross modality prefix', () => {
            const structure = parseRWN('Cross: 60:00');
            expect(structure).not.toBeNull();
            expect(structureToRWN(structure!)).toBe('Cross: 60:00');
        });

        it('preserves rate guidance', () => {
            const structure = parseRWN('30:00@r20');
            expect(structure).not.toBeNull();
            expect(structureToRWN(structure!)).toBe('30:00@r20');
        });
    });

    describe('intervals', () => {
        it('serializes fixed distance intervals', () => {
            const rwn = '4x500m/1:00r';
            const structure = parseRWN(rwn);
            expect(structure).not.toBeNull();
            const serialized = structureToRWN(structure!);
            expect(serialized).toBe('4x500m/1:00r');
        });

        it('serializes fixed time intervals', () => {
            const rwn = '3x10:00/2:00r';
            const structure = parseRWN(rwn);
            expect(structure).not.toBeNull();
            const serialized = structureToRWN(structure!);
            expect(serialized).toBe('3x10:00/2:00r');
        });
    });

    describe('variable / compound', () => {
        it('serializes a pyramid', () => {
            const rwn = '500m/1:00r + 1000m/2:00r + 500m/1:00r';
            const structure = parseRWN(rwn);
            expect(structure).not.toBeNull();
            const serialized = structureToRWN(structure!);
            expect(serialized).toBe('500m/1:00r + 1000m/2:00r + 500m/1:00r');
        });
    });

    describe('block tags', () => {
        it('serializes warmup block tag (serializer expands repeats into variable steps)', () => {
            const rwn = '[w]10:00 + 4x500m/1:00r + [c]5:00';
            const structure = parseRWN(rwn);
            expect(structure).not.toBeNull();
            const serialized = structureToRWN(structure!);
            // Parser produces a variable structure with expanded steps;
            // serializer does not re-compress repeated steps into NxD notation
            expect(serialized).toBe(
                '[w]10:00 + 500m/1:00r + 500m/1:00r + 500m/1:00r + 500m/1:00r + [c]5:00'
            );
        });
    });

    describe('round-trip stability', () => {
        const roundTripCases = [
            '5000m',
            '30:00',
            '4x500m/1:00r',
            '8x500m/1:00r',
            '3x20:00/2:00r',
            '500m/1:00r + 1000m/2:00r + 500m/1:00r',
        ];

        for (const rwn of roundTripCases) {
            it(`parse → serialize → parse is stable for "${rwn}"`, () => {
                const structure1 = parseRWN(rwn);
                expect(structure1).not.toBeNull();

                const serialized = structureToRWN(structure1!);
                const structure2 = parseRWN(serialized);
                expect(structure2).not.toBeNull();

                // Compare structure shape (ignore guidance fields the serializer may drop)
                expect(structure2!.type).toBe(structure1!.type);
                if (structure1!.type === 'interval' && structure2!.type === 'interval') {
                    expect(structure2!.repeats).toBe(structure1!.repeats);
                    expect(structure2!.work.type).toBe(structure1!.work.type);
                    expect(structure2!.work.value).toBe(structure1!.work.value);
                    expect(structure2!.rest.value).toBe(structure1!.rest.value);
                }
                if (structure1!.type === 'steady_state' && structure2!.type === 'steady_state') {
                    expect(structure2!.value).toBe(structure1!.value);
                    expect(structure2!.unit).toBe(structure1!.unit);
                }
            });
        }
    });
});
