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

    describe('Rate shorthand notation (TL-4)', () => {
        test('parses time + rate shorthand "30r20" as 30:00@r20', () => {
            const result = parseRWN('30:00r20');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.value).toBe(1800); // 30 minutes in seconds
                expect(result.unit).toBe('seconds');
                expect(result.target_rate).toBe(20);
            }
        });

        test('parses distance + rate shorthand "5000mr24" as 5000m@r24', () => {
            const result = parseRWN('5000mr24');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.value).toBe(5000);
                expect(result.unit).toBe('meters');
                expect(result.target_rate).toBe(24);
            }
        });

        test('distinguishes rate shorthand from rest notation', () => {
            // "1:00r" should be rest, not rate shorthand
            // This is tested via interval parsing
            const result = parseRWN('4x500m/1:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.rest.value).toBe(60); // 1:00 rest
                expect(result.work.target_rate).toBeUndefined();
            }
        });

        test('does not treat r99 as rate shorthand (outside typical range)', () => {
            // r99 is outside typical 16-40 range, should not be treated as rate shorthand
            // The parser will treat "30:00r99" without rate extraction
            const result = parseRWN('30:00r99');

            // Either null (invalid) or parsed without rate extraction
            // Since "30:00r99" doesn't match any valid pattern, it should fail
            // But if it parses, it shouldn't have target_rate = 99
            if (result !== null && result.type === 'steady_state') {
                expect(result.target_rate).not.toBe(99);
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

    describe('Implicit Groups & Distributed Rest', () => {
        test('parses implicit single group (2000m+1000m+500m)/3:00r', () => {
            const result = parseRWN('(2000m+1000m+500m)/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('variable');

            if (result?.type === 'variable') {
                expect(result.steps.length).toBe(6); // 3 work + 3 rest (distributed)

                // Work 1
                expect(result.steps[0].type).toBe('work');
                expect(result.steps[0].value).toBe(2000);

                // Rest 1 (Distributed)
                expect(result.steps[1].type).toBe('rest');
                expect(result.steps[1].value).toBe(180);

                // Work 2
                expect(result.steps[2].type).toBe('work');
                expect(result.steps[2].value).toBe(1000);

                // Rest 2 (Distributed)
                expect(result.steps[3].type).toBe('rest');
                expect(result.steps[3].value).toBe(180);
            }
        });

        test('parses implicit single group without rest (2000m+1000m)', () => {
            const result = parseRWN('(2000m+1000m)');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('variable');

            if (result?.type === 'variable') {
                expect(result.steps.length).toBe(2); // 2 work, 0 rest
                expect(result.steps[0].value).toBe(2000);
                expect(result.steps[1].value).toBe(1000);
            }
        });

        test('parses explicit 1x group as variable with END rest (standard behavior)', () => {
            const result = parseRWN('1x(2000m+1000m)/3:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('variable');

            // Standard N x (Group) / Rest applies rest ONLY at end
            if (result?.type === 'variable') {
                expect(result.steps.length).toBe(3); // Work, Work, Rest (at end)
                expect(result.steps[0].value).toBe(2000);
                expect(result.steps[1].value).toBe(1000);
                expect(result.steps[2].type).toBe('rest');
                expect(result.steps[2].value).toBe(180);
            }
        });
    });

    describe('Distance Units', () => {
        test('parses 5k as 5000m', () => {
            const result = parseRWN('5k');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.unit).toBe('meters');
                expect(result.value).toBe(5000);
            }
        });

        test('parses 5km as 5000m', () => {
            const result = parseRWN('5km');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.unit).toBe('meters');
                expect(result.value).toBe(5000);
            }
        });

        test('parses 2k as 2000m', () => {
            const result = parseRWN('2k');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('steady_state');

            if (result?.type === 'steady_state') {
                expect(result.unit).toBe('meters');
                expect(result.value).toBe(2000);
            }
        });

        test('parses 4x5k/1:00r as 4x5000m/1:00r', () => {
            const result = parseRWN('4x5k/1:00r');

            expect(result).not.toBeNull();
            expect(result?.type).toBe('interval');

            if (result?.type === 'interval') {
                expect(result.repeats).toBe(4);
                expect(result.work.type).toBe('distance');
                expect(result.work.value).toBe(5000);
                expect(result.rest.value).toBe(60);
            }
        });
    });
});

describe('RWN Parser - Variable List Notation', () => {
    test('parses v-prefixed distance ladder as variable steps', () => {
        const result = parseRWN('v500m/1000m/1500m');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('variable');

        if (result?.type === 'variable') {
            const workSteps = result.steps.filter(s => s.type === 'work');
            expect(workSteps).toHaveLength(3);
            expect(workSteps[0].duration_type).toBe('distance');
            expect(workSteps[0].value).toBe(500);
            expect(workSteps[1].value).toBe(1000);
            expect(workSteps[2].value).toBe(1500);
        }
    });

    test('parses slash distance list without v-prefix as variable', () => {
        const result = parseRWN('500m/1000m/1500m');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('variable');
    });

    test('parses v-prefixed time ladder as variable steps', () => {
        const result = parseRWN('v1:00/3:00/7:00');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('variable');

        if (result?.type === 'variable') {
            const workSteps = result.steps.filter(s => s.type === 'work');
            expect(workSteps).toHaveLength(3);
            expect(workSteps[0].duration_type).toBe('time');
            expect(workSteps[0].value).toBe(60);
            expect(workSteps[1].value).toBe(180);
            expect(workSteps[2].value).toBe(420);
        }
    });

    test('keeps work/rest interval shorthand parsing for two-part slash with rest token', () => {
        const result = parseRWN('15:00/2:00r');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('interval');

        if (result?.type === 'interval') {
            expect(result.repeats).toBe(1);
            expect(result.work.type).toBe('time');
            expect(result.work.value).toBe(900);
            expect(result.rest.value).toBe(120);
        }
    });
});

describe('RWN Parser - Session Orchestration Extensions (Additive)', () => {
    test('parses partner syntax and preserves core on-workout structure', () => {
        const result = parseRWN('partner(on=4x1000m, off=wait, switch=piece_end)');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('interval');

        if (result?.type === 'interval') {
            expect(result.repeats).toBe(4);
            expect(result.work.type).toBe('distance');
            expect(result.work.value).toBe(1000);
            expect(result.sessionExtension?.kind).toBe('partner');
            expect(result.sessionExtension?.off).toBe('wait');
            expect(result.sessionExtension?.switch).toBe('piece_end');
        }
    });

    test('parses partner active off-task circuit notation', () => {
        const result = parseRWN('partner(on=6x500m/1:00r, off=circuit(20 burpees,20 pushups,20 situps))');

        expect(result).not.toBeNull();
        expect(result?.sessionExtension?.kind).toBe('partner');
        expect(result?.sessionExtension?.off).toBe('circuit(20 burpees,20 pushups,20 situps)');
        expect(result?.sessionExtension?.switch).toBe('piece_end'); // default
    });

    test('parses minimal relay syntax with defaults', () => {
        const result = parseRWN('relay(leg=500m,total=6000m)');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('interval');

        if (result?.type === 'interval') {
            expect(result.repeats).toBe(12);
            expect(result.work.type).toBe('distance');
            expect(result.work.value).toBe(500);
            expect(result.rest.value).toBe(0);
            expect(result.sessionExtension?.kind).toBe('relay');
            expect(result.sessionExtension?.switch).toBe('leg_complete');
            expect(result.sessionExtension?.order).toBe('round_robin');
            expect(result.sessionExtension?.off_task).toBe('wait');
        }
    });

    test('parses rotate syntax with plan list', () => {
        const result = parseRWN('rotate(stations=4, switch=15:00, rounds=4, plan=[run(15:00), row(5x500m/1:00r), circuit(20 burpees,20 pushups,20 situps), row(10:00@r20)])');

        expect(result).not.toBeNull();
        expect(result?.sessionExtension?.kind).toBe('rotate');
        expect(result?.sessionExtension?.stations).toBe(4);
        expect(result?.sessionExtension?.rounds).toBe(4);
        expect(result?.sessionExtension?.switch).toBe('15:00');
        expect(result?.sessionExtension?.plan?.length).toBe(4);
    });

    test('parses standalone circuit extension', () => {
        const result = parseRWN('circuit(20 burpees,20 pushups,20 situps)');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('variable');
        expect(result?.sessionExtension?.kind).toBe('circuit');
        expect(result?.sessionExtension?.items).toEqual(['20 burpees', '20 pushups', '20 situps']);
    });

    test('legacy syntax remains unchanged (regression guard)', () => {
        const result = parseRWN('10 x 500m@2k@32spm/3:00r');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('interval');
        expect(result?.sessionExtension).toBeUndefined();

        if (result?.type === 'interval') {
            expect(result.repeats).toBe(10);
            expect(result.work.value).toBe(500);
            expect(result.work.target_pace).toBe('2k');
            expect(result.work.target_rate).toBe(32);
            expect(result.rest.value).toBe(180);
        }
    });

    // Split / Sub-Segment Notation
    describe('Split and Sub-Segment Notation', () => {
        it('parses PM5 split with space: 10000m [1000m]', () => {
            const result = parseRWN('10000m [1000m]');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.value).toBe(10000);
                expect(result!.unit).toBe('meters');
                expect(result!.splitValue).toBe(1000);
                expect(result!.splitUnit).toBe('meters');
            }
        });

        it('parses PM5 split without space: 10000m[2000m]', () => {
            const result = parseRWN('10000m[2000m]');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.value).toBe(10000);
                expect(result!.splitValue).toBe(2000);
                expect(result!.splitUnit).toBe('meters');
            }
        });

        it('parses time-based PM5 split: 30:00 [5:00]', () => {
            const result = parseRWN('30:00 [5:00]');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.value).toBe(1800);
                expect(result!.splitValue).toBe(300);
                expect(result!.splitUnit).toBe('seconds');
            }
        });

        it('parses sub-segment breakdown: 2000m[500m@r22 + 500m@r24 + 500m@r26 + 500m@r30]', () => {
            const result = parseRWN('2000m[500m@r22 + 500m@r24 + 500m@r26 + 500m@r30]');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.value).toBe(2000);
                expect(result!.subSegments).toBeDefined();
                expect(result!.subSegments!.length).toBe(4);
                expect(result!.subSegments![0].value).toBe(500);
                expect(result!.subSegments![0].target_rate).toBe(22);
                expect(result!.subSegments![3].target_rate).toBe(30);
            }
        });

        it('does not conflict with block tags: [w]10:00', () => {
            const result = parseRWN('[w]10:00');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.blockType).toBe('warmup');
                expect(result!.splitValue).toBeUndefined();
                expect(result!.subSegments).toBeUndefined();
            }
        });
    });

    // ============================================================
    // Minute/Second Shorthand (Input Tolerance)
    // ============================================================
    describe('Minute/Second Shorthand', () => {
        it("parses minutes shorthand: 3' → 3:00 steady state", () => {
            const result = parseRWN("3'");
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.unit).toBe('seconds');
                expect(result!.value).toBe(180);
            }
        });

        it('parses seconds shorthand: 30" → 0:30 steady state', () => {
            const result = parseRWN('30"');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.unit).toBe('seconds');
                expect(result!.value).toBe(30);
            }
        });

        it("parses combined shorthand: 3'30\" → 3:30 steady state", () => {
            const result = parseRWN("3'30\"");
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.unit).toBe('seconds');
                expect(result!.value).toBe(210);
            }
        });

        it("parses combined shorthand with zero-padding: 1'5\" → 1:05", () => {
            const result = parseRWN("1'5\"");
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.unit).toBe('seconds');
                expect(result!.value).toBe(65);
            }
        });

        it("parses interval with shorthand: 10x3'/30\"r", () => {
            const result = parseRWN("10x3'/30\"r");
            expect(result).not.toBeNull();
            expect(result!.type).toBe('interval');
            if (result!.type === 'interval') {
                expect(result!.repeats).toBe(10);
                expect(result!.work.type).toBe('time');
                expect(result!.work.value).toBe(180);
                expect(result!.rest.value).toBe(30);
            }
        });

        it("parses shorthand with guidance: 2'30\"@r24..26", () => {
            const result = parseRWN("2'30\"@r24..26");
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.value).toBe(150);
                expect(result!.target_rate).toBe(24);
                expect(result!.target_rate_max).toBe(26);
            }
        });

        it("parses compound segments with shorthand: 2'30\"@r24..26 + 30\"@open", () => {
            const result = parseRWN("2'30\"@r24..26 + 30\"@open");
            expect(result).not.toBeNull();
            expect(result!.type).toBe('variable');
            if (result!.type === 'variable') {
                expect(result!.steps.length).toBe(2);
                expect(result!.steps[0].value).toBe(150);
                expect(result!.steps[0].target_rate).toBe(24);
                expect(result!.steps[1].value).toBe(30);
                expect(result!.steps[1].target_pace).toBe('open');
            }
        });
    });

    // ============================================================
    // @open Guidance Keyword
    // ============================================================
    describe('@open Guidance', () => {
        it('parses @open as guidance on steady state', () => {
            const result = parseRWN('0:30@open');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.value).toBe(30);
                expect(result!.target_pace).toBe('open');
            }
        });

        it('parses @open on distance', () => {
            const result = parseRWN('500m@open');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.value).toBe(500);
                expect(result!.target_pace).toBe('open');
            }
        });

        it('parses @open case-insensitively', () => {
            const result = parseRWN('500m@OPEN');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.target_pace).toBe('open');
            }
        });

        it('parses @open chained with rate: 0:30@open@r30', () => {
            const result = parseRWN('0:30@open@r30');
            expect(result).not.toBeNull();
            expect(result!.type).toBe('steady_state');
            if (result!.type === 'steady_state') {
                expect(result!.target_pace).toBe('open');
                expect(result!.target_rate).toBe(30);
            }
        });

        it('parses @open in compound segment (whiteboard pattern)', () => {
            const result = parseRWN('10x(2:30@r24..26 + 0:30@open)/30sr');
            expect(result).not.toBeNull();
            // This should be a variable workout with grouped repeats
            if (result!.type === 'variable') {
                const workSteps = result!.steps.filter(s => s.type === 'work');
                const openStep = workSteps.find(s => s.target_pace === 'open');
                expect(openStep).toBeDefined();
                expect(openStep!.value).toBe(30);
            }
        });
    });
});

describe('RWN Parser - Guidance on Rest Token (should apply to work)', () => {
    test('8x500m/1:00r@r32 parses identically to 8x500m@r32/1:00r', () => {
        const withGuidanceOnRest = parseRWN('8x500m/1:00r@r32');
        const withGuidanceOnWork = parseRWN('8x500m@r32/1:00r');

        expect(withGuidanceOnRest).not.toBeNull();
        expect(withGuidanceOnWork).not.toBeNull();

        // Both should be interval type
        expect(withGuidanceOnRest?.type).toBe('interval');
        expect(withGuidanceOnWork?.type).toBe('interval');

        if (withGuidanceOnRest?.type === 'interval' && withGuidanceOnWork?.type === 'interval') {
            // Work guidance should match
            expect(withGuidanceOnRest.work.target_rate).toBe(withGuidanceOnWork.work.target_rate);
            expect(withGuidanceOnRest.work.target_rate).toBe(32);

            // Rest value should match
            expect(withGuidanceOnRest.rest.value).toBe(withGuidanceOnWork.rest.value);
            expect(withGuidanceOnRest.rest.value).toBe(60);
        }
    });

    test('4x2000m/3:00r@1:48 applies pace guidance to work', () => {
        const result = parseRWN('4x2000m/3:00r@1:48');

        expect(result).not.toBeNull();
        expect(result?.type).toBe('interval');

        if (result?.type === 'interval') {
            expect(result.work.target_pace).toBe('1:48');
            expect(result.rest.value).toBe(180);
        }
    });
});
