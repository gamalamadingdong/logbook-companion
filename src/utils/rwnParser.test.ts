import { parseRWN } from './rwnParser';

describe('RWN Parser - Chained Guidance Parameters', () => {
    describe('Chained @ parameters (pace + stroke rate)', () => {
        test('parses 10 x 500m@2k@32spm/3:00r correctly', () => {
            const result = parseRWN('10 x 500m@2k@32spm/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.repeats).toBe(10);
                expect(result.work.type).toBe('distance');
                expect(result.work.value).toBe(500);
                expect(result.work.target_pace).toBe('2k');
                expect(result.work.target_rate).toBe(32);
                expect(result.rest.value).toBe(180); // 3:00 = 180 seconds
            }
        });

        test('parses 8 x 2000m@6k-5@24spm/5:00r correctly', () => {
            const result = parseRWN('8 x 2000m@6k-5@24spm/5:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.repeats).toBe(8);
                expect(result.work.type).toBe('distance');
                expect(result.work.value).toBe(2000);
                expect(result.work.target_pace).toBe('6k-5');
                expect(result.work.target_rate).toBe(24);
                expect(result.rest.value).toBe(300); // 5:00 = 300 seconds
            }
        });

        test('parses 5 x 1000m@1:50@28spm/2:00r correctly', () => {
            const result = parseRWN('5 x 1000m@1:50@28spm/2:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.repeats).toBe(5);
                expect(result.work.type).toBe('distance');
                expect(result.work.value).toBe(1000);
                expect(result.work.target_pace).toBe('1:50');
                expect(result.work.target_rate).toBe(28);
                expect(result.rest.value).toBe(120); // 2:00 = 120 seconds
            }
        });

        test('parses reversed order @32spm@2k correctly', () => {
            const result = parseRWN('10 x 500m@32spm@2k/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_pace).toBe('2k');
                expect(result.work.target_rate).toBe(32);
            }
        });
    });

    describe('Single @ parameter (backwards compatibility)', () => {
        test('parses pace-only guidance correctly', () => {
            const result = parseRWN('10 x 500m@2k/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_pace).toBe('2k');
                expect(result.work.target_rate).toBeUndefined();
            }
        });

        test('parses rate-only guidance correctly', () => {
            const result = parseRWN('10 x 500m@32spm/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type === 'interval');

            if (result?.type === 'interval') {
                expect(result.work.target_rate).toBe(32);
                expect(result.work.target_pace).toBeUndefined();
            }
        });

        test('parses r-notation rate correctly', () => {
            const result = parseRWN('10 x 500m@r20/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_rate).toBe(20);
                expect(result.work.target_pace).toBeUndefined();
            }
        });
    });

    describe('Steady state with chained guidance', () => {
        test('parses steady state with pace and rate', () => {
            const result = parseRWN('5000m@2k+10@22spm');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.value).toBe(5000);
                expect(result.unit).toBe('meters');
                expect(result.target_pace).toBe('2k+10');
                expect(result.target_rate).toBe(22);
            }
        });
    });
});
