
import { calculateCanonicalName, detectIntervalsFromStrokes } from '../src/utils/workoutNaming';
import fs from 'fs';
import path from 'path';

// --- Types ---
interface TestInterval {
    type: 'distance' | 'time' | 'cal' | 'watt';
    distance: number;
    time: number; // deciseconds
    rest_time?: number; // deciseconds
    watts?: number;
    calories_total?: number;
}

function createInterval(dist: number, time: number, rest: number): TestInterval {
    return { type: 'distance', distance: dist, time: time, rest_time: rest };
}

function runTest(name: string, intervals: TestInterval[], expectedName: string) {
    // Cast to any to satisfy C2Interval partial match
    const result = calculateCanonicalName(intervals as any);
    const pass = result === expectedName || result.includes(expectedName);

    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}`);
    console.log(`   Output:   "${result}"`);
    if (!pass) console.log(`   Expected: "${expectedName}"`);
    console.log('---');
}

console.log('Running Workout Naming Verification (Synthetic)...\n');

// 1. 3x12min
// 12 mins = 720 seconds = 7200 deciseconds.
// Distance approx 3000m per interval.
// Rest ? Assuming some rest.
runTest('3x12min', [
    { type: 'time', time: 7200, distance: 3000, rest_time: 1200 },
    { type: 'time', time: 7200, distance: 3050, rest_time: 1200 },
    { type: 'time', time: 7200, distance: 3020, rest_time: 1200 }
], '3x12:00');

// 2. Descending Variable (1000, 750, 500, 250)
runTest('Descending (1k, 750, 500, 250)', [
    { type: 'distance', distance: 1000, time: 2000, rest_time: 600 },
    { type: 'distance', distance: 750, time: 1500, rest_time: 600 },
    { type: 'distance', distance: 500, time: 1000, rest_time: 600 },
    { type: 'distance', distance: 250, time: 500, rest_time: 600 }
], 'v1000...250m Ladder');

// 3. Speed Pyramid (250, 500, 750, 500, 250)
runTest('Speed Pyramid (250...750...250)', [
    { type: 'distance', distance: 250, time: 500, rest_time: 0 },
    { type: 'distance', distance: 500, time: 1000, rest_time: 0 },
    { type: 'distance', distance: 750, time: 1500, rest_time: 0 },
    { type: 'distance', distance: 500, time: 1000, rest_time: 0 },
    { type: 'distance', distance: 250, time: 500, rest_time: 0 }
], 'v250m... Pyramid'); // Assuming current logic detects this

// 4. Repeating Complex (4x 750/500/250)
const chunk = [
    { type: 'distance', distance: 750, time: 1500, rest_time: 0 },
    { type: 'distance', distance: 500, time: 1000, rest_time: 0 },
    { type: 'distance', distance: 250, time: 500, rest_time: 0 }
];
// 3 repetitions
const repeatingIntervals = [...chunk, ...chunk, ...chunk];
runTest('Repeating Pattern (3x 750/500/250)', repeatingIntervals as any, '3x 750/500/250m');

// 4b. Long Variable List (12 items)
// Logic detects this as a Ladder now (Ascending)
const longList = Array.from({ length: 12 }, (_, i) => ({
    type: 'distance',
    distance: 500 + (i * 10), // 500, 510, 520...
    time: 0, // Explicitly 0
    rest_time: 0
}));
runTest('Long Variable List (12 items)', longList as any, 'v500...610m Ladder');

// 4c. Mixed Variable (New Fix)
// 500m, 1:00, 500m
const mixedList = [
    { type: 'distance', distance: 500, time: 0, rest_time: 0 }, // 500m
    { type: 'time', distance: 0, time: 600, rest_time: 0 },     // 1:00 (600ds)
    { type: 'distance', distance: 500, time: 0, rest_time: 0 }  // 500m
];
runTest('Mixed Variable (v500m/1:00/500m)', mixedList as any, 'v500m/1:00/500m');

// 5. Classic 8x500m
runTest('Classic 8x500', Array(8).fill({ type: 'distance', distance: 500, time: 1000, rest_time: 1200 }), '8x500m/2:00r');

// 6. Dirty Data (Slightly variable distances)
runTest('Fuzzy 4x1000 (999, 1001, 1000, 998)', [
    { type: 'distance', distance: 999, time: 2000, rest_time: 1200 },
    { type: 'distance', distance: 1001, time: 2000, rest_time: 1200 },
    { type: 'distance', distance: 1000, time: 2000, rest_time: 1200 },
    { type: 'distance', distance: 998, time: 2000, rest_time: 1200 }
], '4x1000m/2:00r');

// 7. Ladder (Ascending)
runTest('Ascending Ladder (100...1000)',
    // 2:00 pace = 0.24s/m = 2.4 ds/m. 100m -> 240ds.
    Array.from({ length: 10 }, (_, i) => createInterval((i + 1) * 100, (i + 1) * 240, 60)),
    'v100...1000m Ladder'
);

// 8. Ladder (Descending)
runTest('Descending Ladder (1000...100)',
    // 2:00 pace = 0.24s/m = 2.4 ds/m. 100m -> 240ds.
    Array.from({ length: 10 }, (_, i) => createInterval((10 - i) * 100, (10 - i) * 240, 60)),
    'v1000...100m Ladder'
);

// 9. Basic Types (Regression Check)
runTest('Single Distance (2000m)',
    [{ type: 'distance', distance: 2000, time: 4200, rest_time: 0 }],
    '2000m'
);
runTest('Single Time (30:00)',
    [{ type: 'time', distance: 7500, time: 18000, rest_time: 0 }],
    '30:00'
);

// 10. Live Records File
console.log('\n10. Live Records File (live_test_data.json)');
try {
    const multiPath = path.join(process.cwd(), 'db', 'live_test_data.json');
    if (fs.existsSync(multiPath)) {
        const content = fs.readFileSync(multiPath, 'utf-8');
        const records = JSON.parse(content);
        console.log(`Loaded ${records.length} records.`);

        let stats = { total: 0, pass: 0, warn: 0, skip: 0 };
        console.log('Processing records...');

        records.forEach((rec: any, idx: number) => {
            let intervals = [];
            let raw: any = rec.raw_data || {};

            stats.total++;

            if (raw.workout?.intervals) {
                intervals = raw.workout.intervals;
            } else if (raw.strokes) {
                intervals = detectIntervalsFromStrokes(raw.strokes);
            }

            if (!intervals || intervals.length === 0) {
                stats.skip++;
                return;
            }

            const name = calculateCanonicalName(intervals as any);
            const isUnstructured = name === 'Unstructured' || name === 'Unknown';

            if (isUnstructured) {
                stats.warn++;
                console.log(`[WARN] Record ${idx} (DB: ${rec.canonical_name}) -> Generated: "${name}"`);
                const simple = intervals.slice(0, 5).map((i: any) => `${i.distance}m/${(i.time / 10).toFixed(1)}s`);
                console.log(`       Intervals (${intervals.length}): ${simple.join(', ')}...`);
            } else {
                stats.pass++;
                if (rec.canonical_name === 'Unstructured') {
                    console.log(`[FIXED] Record ${idx} (DB: Unstructured) -> Generated: "${name}"`);
                }
            }
        });
        console.log('\n--- Summary ---');
        console.log(`Total: ${stats.total}, Pass: ${stats.pass}, Warn: ${stats.warn}, Skip: ${stats.skip}`);
    } else {
        console.log('live_test_data.json not found.');
    }
} catch (e) {
    console.error('Failed to process multiple records file', e);
}
