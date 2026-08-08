import { describe, it, expect } from 'vitest';
import { parseRWN } from '../parser';
import { structureToRWN } from '../serializer';

const specSectionThreeAndFourExamples = [
    '2000m',
    '5k',
    '5km',
    '30:00',
    '300cal',
    '4x2000m/...r',
    '10x500m/...r',
    '(2000m + 1000m + 500m) / 3:00r',
    '30:00@r20',
    '8x500m/1:00r@r32',
    '60:00@18..22spm',
    '4x2000m/5:00r@r24..28',
    '20:00@22-24spm',
    '2000m@1:45',
    '10x500m@2k/3:00r',
    '5000m@2k+10',
    '4x1000m/3:30r@1:50',
    '60:00@2:05..2:10',
    '8x500m@1:48..1:52/3:00r',
    '8x500m@2k-1..2k-5/3:00r',
    '60:00@2:05-2:10',
    '3x20:00/2:00r@UT2',
    '10x1:00/1:00r@AN',
    '0:30@open',
    '500m@open',
    '10x(2:30@r24..26 + 0:30@open)/30sr',
    '30:00@UT2@r20',
    '5000m@2k+5@r28',
    '8x500m/1:00r@1:50@r32',
    '60:00@r18..22@UT2',
    '4x2000m/5:00r@2k@r24..28',
] as const;

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

        it('serializes calorie intervals', () => {
            const structure = {
                type: 'interval',
                repeats: 4,
                work: {
                    type: 'calories',
                    value: 12,
                },
                rest: {
                    type: 'time',
                    value: 60,
                },
            };

            expect(structureToRWN(structure)).toBe('4x12c/1:00r');
        });

        it('omits undefined interval rest instead of serializing it', () => {
            const structure = {
                type: 'interval',
                repeats: 4,
                work: {
                    type: 'distance',
                    value: 500,
                },
                rest: {
                    type: 'time',
                    value: undefined,
                },
            };

            expect(structureToRWN(structure)).toBe('4x500m');
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

    describe('spec examples round-trip', () => {
        for (const rwn of specSectionThreeAndFourExamples) {
            it(`round-trips "${rwn}" from RWN_spec sections 3-4`, () => {
                const parsed = parseRWN(rwn);
                expect(parsed).not.toBeNull();

                const roundTripped = parseRWN(structureToRWN(parsed!));
                expect(roundTripped).toEqual(parsed);
            });
        }
    });
});
