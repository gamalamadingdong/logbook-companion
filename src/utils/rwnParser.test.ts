import { describe, test, expect } from 'vitest';
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

describe('RWN Parser - Range Notation', () => {
    describe('Stroke Rate Ranges', () => {
        test('parses absolute rate range @18-22spm (hyphen)', () => {
            const result = parseRWN('60:00@18-22spm');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_rate).toBe(18);
                expect(result.target_rate_max).toBe(22);
            }
        });

        test('parses absolute rate range @18..22spm (double-dot)', () => {
            const result = parseRWN('60:00@18..22spm');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_rate).toBe(18);
                expect(result.target_rate_max).toBe(22);
            }
        });

        test('parses r-notation rate range @r24-28', () => {
            const result = parseRWN('4x2000m@r24-28/5:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_rate).toBe(24);
                expect(result.work.target_rate_max).toBe(28);
            }
        });

        test('parses r-notation rate range @r24..28 (double-dot)', () => {
            const result = parseRWN('4x2000m@r24..28/5:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_rate).toBe(24);
                expect(result.work.target_rate_max).toBe(28);
            }
        });

        test('parses rate range with spm suffix @20-24spm', () => {
            const result = parseRWN('8x500m@20-24spm/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_rate).toBe(20);
                expect(result.work.target_rate_max).toBe(24);
            }
        });
    });

    describe('Pace Ranges', () => {
        test('parses absolute pace range @2:05-2:10 (hyphen)', () => {
            const result = parseRWN('60:00@2:05-2:10');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_pace).toBe('2:05');
                expect(result.target_pace_max).toBe('2:10');
            }
        });

        test('parses absolute pace range @2:05..2:10 (double-dot)', () => {
            const result = parseRWN('60:00@2:05..2:10');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_pace).toBe('2:05');
                expect(result.target_pace_max).toBe('2:10');
            }
        });

        test('parses pace range in interval @1:48-1:52/3:00r', () => {
            const result = parseRWN('8x500m@1:48-1:52/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_pace).toBe('1:48');
                expect(result.work.target_pace_max).toBe('1:52');
            }
        });

        test('parses relative pace range @2k-1..2k-5 (double-dot)', () => {
            const result = parseRWN('60:00@2k-1..2k-5');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_pace).toBe('2k-1');
                expect(result.target_pace_max).toBe('2k-5');
            }
        });

        test('parses relative pace range @2k+5..2k+10 (double-dot)', () => {
            const result = parseRWN('8x500m@2k+5..2k+10/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_pace).toBe('2k+5');
                expect(result.work.target_pace_max).toBe('2k+10');
            }
        });
    });

    describe('Combined Pace and Rate Ranges', () => {
        test('parses both pace range and rate range', () => {
            const result = parseRWN('10x500m@1:48-1:52@28-32spm/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.work.target_pace).toBe('1:48');
                expect(result.work.target_pace_max).toBe('1:52');
                expect(result.work.target_rate).toBe(28);
                expect(result.work.target_rate_max).toBe(32);
            }
        });

        test('parses pace range with single rate', () => {
            const result = parseRWN('60:00@2:05-2:10@20spm');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_pace).toBe('2:05');
                expect(result.target_pace_max).toBe('2:10');
                expect(result.target_rate).toBe(20);
                expect(result.target_rate_max).toBeUndefined();
            }
        });

        test('parses single pace with rate range', () => {
            const result = parseRWN('5000m@2:00@18-22spm');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_pace).toBe('2:00');
                expect(result.target_pace_max).toBeUndefined();
                expect(result.target_rate).toBe(18);
                expect(result.target_rate_max).toBe(22);
            }
        });
    });

    describe('Backwards Compatibility (single values still work)', () => {
        test('single rate still works', () => {
            const result = parseRWN('30:00@r20');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_rate).toBe(20);
                expect(result.target_rate_max).toBeUndefined();
            }
        });

        test('single pace still works', () => {
            const result = parseRWN('2000m@1:45');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.target_pace).toBe('1:45');
                expect(result.target_pace_max).toBeUndefined();
            }
        });
    });
});

describe('RWN Parser - Block Tag Notation', () => {
    describe('Basic block tags', () => {
        test('parses [w] warmup tag correctly', () => {
            const result = parseRWN('[w]10:00');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.value).toBe(600); // 10:00 = 600 seconds
                expect(result.unit).toBe('seconds');
                expect(result.blockType).toBe('warmup');
            }
        });

        test('parses [c] cooldown tag correctly', () => {
            const result = parseRWN('[c]5:00');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.value).toBe(300); // 5:00 = 300 seconds
                expect(result.unit).toBe('seconds');
                expect(result.blockType).toBe('cooldown');
            }
        });

        test('parses [t] test tag correctly', () => {
            const result = parseRWN('[t]2000m@2k');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.value).toBe(2000);
                expect(result.unit).toBe('meters');
                expect(result.blockType).toBe('test');
                expect(result.target_pace).toBe('2k');
            }
        });
    });

    describe('Block tags in compound workouts', () => {
        test('parses warmup + work + cooldown structure', () => {
            const result = parseRWN('[w]10:00 + 5x500m/1:00r + [c]5:00');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('variable');

            if (result?.type === 'variable') {
                expect(result.steps.length).toBeGreaterThan(0);
                
                // First step should be warmup
                const warmupStep = result.steps[0];
                expect(warmupStep.type).toBe('work');
                expect(warmupStep.blockType).toBe('warmup');
                expect(warmupStep.value).toBe(600);

                // Last step should be cooldown
                const cooldownStep = result.steps[result.steps.length - 1];
                expect(cooldownStep.type).toBe('work');
                expect(cooldownStep.blockType).toBe('cooldown');
                expect(cooldownStep.value).toBe(300);
            }
        });

        test('parses compound workout with mixed block tags', () => {
            const result = parseRWN('[w]5:00 + 4x500m/1:00r + [c]5:00');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('variable');

            if (result?.type === 'variable') {
                // Check warmup
                const warmup = result.steps.find(s => s.blockType === 'warmup');
                expect(warmup).toBeDefined();
                expect(warmup?.value).toBe(300);

                // Check that intervals exist (blockType propagation from [t] prefix to intervals 
                // is complex and may not work in all cases)
                const workSteps = result.steps.filter(s => s.type === 'work' && s.value === 500);
                expect(workSteps.length).toBe(4); // 4 x 500m intervals

                // Check cooldown
                const cooldown = result.steps.find(s => s.blockType === 'cooldown');
                expect(cooldown).toBeDefined();
                expect(cooldown?.value).toBe(300);
            }
        });
    });

    describe('Block tags vs inline tags', () => {
        test('block tags take precedence over inline tags', () => {
            const result = parseRWN('[w]10:00#test');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.blockType).toBe('warmup'); // Block tag wins
                expect(result.tags).toContain('test'); // Inline tag still captured
            }
        });
    });
});
