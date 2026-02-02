import { calculatePowerBuckets } from '../src/utils/powerBucketing.ts';

// Helper to ensure TypeScript can run this TS file via ts-node or similar
// We might just run it via simple execution if we compile it, 
// but for now let's assume we can run it or just look at the code logic.
// Actually, this environment runs .ts scripts via ts-node implicitly usually.

// Synthetic Test Data
// We'll create a fake workout with known pace/time to verify the buckets.
// 2:00 / 500m = 202.5 Watts.
// We'll do 30 seconds of that.
// 0.1s units for time and pace.

const pace2_00 = 1200; // 120.0 seconds / 500m
// Watts = 2.80 / (pace_sec_per_m ^ 3)
// 120s / 500m = 0.24 s/m
// 0.24^3 = 0.013824
// 2.80 / 0.013824 = 202.54 Watts -> Rounds to 203W.
// Bucket floor: 200W.

const strokes = [];
for (let i = 0; i <= 300; i++) { // 30 seconds (300 * 0.1s)
    strokes.push({
        p: pace2_00,
        t: i * 1, // 0, 1, 2... 300 (0.1s increments? No, t is in 0.1s units usually)
        // Wait, typical C2 data has t as cumulative seconds? 
        // Let's re-read the code for powerBucketing.
        // "t is in 0.1s units" according to my comment in powerBucketing.
        // So 30 seconds = 300 units.
        d: 0
    });
}
// Actually, strokes usually come sparsely (every stroke).
// But calculatePowerBuckets iterates strokes and takes delta t.
// So let's mock 10 strokes, each taking 3 seconds.
const mockStrokes = [];
let t = 0;
for (let i = 0; i < 10; i++) {
    t += 30; // 3.0 seconds per stroke
    mockStrokes.push({
        p: pace2_00,
        t: t,
        d: 0
    });
}
// Total duration = 30 seconds.
// Watts = ~203.
// Bucket should be 200W.

console.log("\n--- Running Synthetic Verification ---");
const result = calculatePowerBuckets({
    id: 1,
    strokes: mockStrokes
} as any);

console.log("Buckets:", result);

// Expected: { "200": 30.0 }
const expectedWatts = 203;
const expectedBucket = "200";

if (result[expectedBucket] === 30) {
    console.log("✅ SUCCESS: 30 seconds correctly bucketed into 200W bucket.");
} else {
    console.error("❌ FAILURE: Expected 30s in 200W bucket.");
}
