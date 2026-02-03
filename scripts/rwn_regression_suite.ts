
import { parseRWN } from '../src/utils/rwnParser.ts';
import { calculateCanonicalName } from '../src/utils/workoutNaming.ts';
import { structureToIntervals } from '../src/utils/structureAdapter.ts';

interface TestCase {
    input: string;
    expectedType: string;
    expectedName?: string; // Optional canonical name check
    expectedTags?: string[]; // Optional tag check
    description?: string;
    skip?: boolean;
}

const testCases: TestCase[] = [
    // 2.1 Standard Interval Notation
    { input: '4x500m/1:00r', expectedType: 'interval' },
    { input: '3x20:00/2:00r', expectedType: 'interval' },
    { input: '10x1:00/1:00r', expectedType: 'interval' },

    // 2.2 Steady State
    { input: '10000m', expectedType: 'steady_state' },
    { input: '30:00', expectedType: 'steady_state' },

    // 2.3 Tagged Workouts
    { input: '10000m #test', expectedType: 'steady_state', expectedTags: ['test'] },
    { input: '2000m #warmup', expectedType: 'steady_state', expectedTags: ['warmup'] },
    { input: '5000m #cooldown', expectedType: 'steady_state', expectedTags: ['cooldown'] },
    { input: '2x20:00/2:00r #benchmark', expectedType: 'interval', expectedTags: ['benchmark'] },

    // User's "10k Sandwich" Case
    // 10000m, 10:00r, 10000m -> 2x10000m/10:00r
    { input: '2x10000m/10:00r', expectedType: 'interval', description: '10k Sandwich' },

    // 4. Extended Syntax
    { input: '30:00@r20', expectedType: 'steady_state' }, // Rate guidance
    { input: '8x500m/1:00r@r32', expectedType: 'interval' },
    { input: '2000m@1:45', expectedType: 'steady_state' }, // Pace guidance
    { input: '10x500m@2k/3:00r', expectedType: 'interval' }, // Bare reference pace
    { input: '5000m@5k', expectedType: 'steady_state' }, // Bare reference pace
    { input: '3x20:00/2:00r@UT2', expectedType: 'interval' }, // Zone guidance

    // 5. Segmented Workouts (Compound)
    { input: '2000m + 1000m', expectedType: 'variable' },
    { input: '10:00@r22 + 5:00@r26', expectedType: 'variable' },
    // Regression check for '+' in pacing guidance not splitting steps
    { input: '5000m@2k+20 + 5000m@2k+12', expectedType: 'variable' },

    // 5.3 Complex Repeats (The Bug Case + Naming Verification)
    {
        input: '3x(750m/3:00r + 500m/3:00r + 250m/6:00r)',
        expectedType: 'variable',
        description: 'Nested Complex Interval (Round Trip)',
        expectedName: '3x 750m/500m/250m/3:00r' // Checking the canonical name logic upgrade
    },

    // 9. Machine Types
    { input: 'Bike: 15000m', expectedType: 'steady_state' },
    { input: 'Ski: 8x500m/3:30r', expectedType: 'interval' }
];

let passed = 0;
let failed = 0;

console.log('Running RWN Regression Suite...\n');

testCases.forEach((test, index) => {
    if (test.skip) return;

    try {
        const result = parseRWN(test.input);

        let failureReason = null;

        if (!result) {
            failureReason = "Returned null";
        } else if (result.type !== test.expectedType) {
            failureReason = `Type mistmatch. Expected ${test.expectedType}, got ${result.type}`;
        } else {
            // Check for tags
            if (test.expectedTags) {
                const resultTags = result.tags || [];
                const missingTags = test.expectedTags.filter(t => !resultTags.includes(t));
                const extraTags = resultTags.filter((t: string) => !test.expectedTags!.includes(t));

                if (missingTags.length > 0 || extraTags.length > 0) {
                    failureReason = `Tag mistmatch. Expected [${test.expectedTags.join(', ')}], got [${resultTags.join(', ')}]`;
                }
            }

            // Check for correct unrolling for the complex case
            if (test.input.includes('3x(') && result.type === 'variable') {
                const count = (result as any).steps.length;
                if (count < 15) {
                    failureReason = `Not unrolled enough steps (Got ${count})`;
                }
            }

            // Check Canonical Name if expected
            if (!failureReason && test.expectedName) {
                // Must convert Structure -> Intervals -> Name
                const intervals = structureToIntervals(result);
                // NOTE: structureToIntervals might not set calories identical to the Test_Naming_Logic mocked data,
                // so we are relying on our NEW logic prioritizing PATTERN over WATTS/CALS.
                // The structureAdapter sets default watts/cals if missing? 
                // Let's verify structureToIntervals output if needed, but for now trusting it.
                const generatedName = calculateCanonicalName(intervals);

                // Allow some tolerance on spaces?
                // The expected name is '3x 750m/500m/250m/3:00r'
                if (generatedName !== test.expectedName) {
                    failureReason = `Canonical Name Mismatch. Got: "${generatedName}" Expected: "${test.expectedName}"`;
                }
            }
        }

        if (failureReason) {
            console.log(`❌ [FAIL] ${test.input}`);
            console.log(`   Reason: ${failureReason}`);
            failed++;
        } else {
            // Success
            console.log(`✅ [PASS] ${test.input} ${test.expectedName ? `-> "${test.expectedName}"` : ''} ${test.expectedTags ? `[Tags: ${test.expectedTags}]` : ''}`);
            passed++;
        }

    } catch (e) {
        console.log(`❌ [FAIL] ${test.input} - Exception: ${e}`);
        failed++;
    }
});

console.log(`\nSummary: ${passed} Passed, ${failed} Failed`);

if (failed > 0) process.exit(1);
