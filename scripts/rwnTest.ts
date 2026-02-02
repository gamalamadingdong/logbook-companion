
import { parseRWN } from '../src/utils/rwnParser';
import { structureToIntervals } from '../src/utils/structureAdapter';
import { calculateCanonicalName } from '../src/utils/prCalculator';

const TEST_CASES = [
    { input: '2000m', label: 'Steady State Dist' },
    { input: '30:00', label: 'Steady State Time' },
    { input: '4x500m/2:00r', label: 'Standard Interval' },
    { input: '8 x 500m / 3:30r', label: 'Standard Interval Loose' },
    { input: '2000m + 1000m + 500m', label: 'Variable Continuous' },
    { input: '2000m/2r + 1000m/1r', label: 'Variable Mixed' },
    { input: 'v500m/1:00r... Ladder', label: 'Explicit Variable' },
    { input: '10000m', label: 'Steady State 10k' },
];

async function runTests() {
    console.log('--- RWN Parser & Naming Verification ---\n');

    let passed = 0;
    let failed = 0;

    for (const test of TEST_CASES) {
        console.log(`[TEST] ${test.label}: "${test.input}"`);

        try {
            const structure = parseRWN(test.input);
            if (!structure) {
                console.log('  ❌ Parser returned null');
                failed++;
                continue;
            }

            // Debug Structure
            if (structure.type === 'steady_state') {
                console.log(`  Structure: Steady ${structure.value} ${structure.unit}`);
            } else if (structure.type === 'interval') {
                console.log(`  Structure: Interval ${structure.repeats}x ${structure.work.value} (${structure.work.type})`);
            } else if (structure.type === 'variable') {
                console.log(`  Structure: Variable with ${structure.steps.length} steps`);
            }

            const intervals = structureToIntervals(structure);
            // Debug Interval 0
            if (intervals.length > 0) {
                console.log(`  Interval[0]: Dist=${intervals[0].distance}, Time=${intervals[0].time}, Type=${intervals[0].type}`);
            }

            const name = calculateCanonicalName(intervals);
            console.log(`  Canonical Name: "${name}"`);

            if (name === 'Unstructured' || name === 'Unknown') {
                console.log('  ⚠️ Name is Unstructured/Unknown');
            } else {
                console.log('  ✅ Parsed & Named');
            }

        } catch (e: any) {
            console.log(`  ❌ Exception: ${e.message}`);
            failed++;
        }
        console.log('');
    }

    console.log(`--- Done. Passed (Parsed): ${passed + failed - failed} (approx) ---`);
}

runTests();
