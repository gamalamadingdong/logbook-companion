
import { calculateCanonicalName } from '../src/utils/prCalculator.ts';
import type { C2Interval } from '../src/api/concept2.types.ts';

console.log("Verifying fixes for Workout Naming Logic...\n");

// 1. Synthetic "Messy" Workout (matches user report: 416, 899...)
// Key: Times must be uneven to fail isCleanTime check.
const messyIntervals: C2Interval[] = [
    { type: 'distance', distance: 416, time: 1011, stroke_rate: 24, rest_time: 0, end_date: '' }, // 101.1s
    { type: 'distance', distance: 899, time: 2022, stroke_rate: 24, rest_time: 0, end_date: '' }, // 202.2s
    { type: 'distance', distance: 1355, time: 3033, stroke_rate: 24, rest_time: 0, end_date: '' },
    { type: 'distance', distance: 1019, time: 2544, stroke_rate: 24, rest_time: 0, end_date: '' },
    { type: 'distance', distance: 9, time: 25, stroke_rate: 24, rest_time: 0, end_date: '' },
];
const messyName = calculateCanonicalName(messyIntervals);
console.log(`[TEST] Messy Intervals (416, 899, 1355, 1019, 9)`);
console.log(`       EXPECTED: "Unstructured"`);
console.log(`       ACTUAL:   "${messyName}"`);
console.log(messyName === "Unstructured" ? "✅ PASS" : "❌ FAIL");
console.log("");

// 2. Clean Variable Intervals (Pyramid check)
// 500-1000-500 is a pyramid. Code returns v500m... Pyramid
const cleanIntervals: C2Interval[] = [
    { type: 'distance', distance: 500, time: 1000, stroke_rate: 30, rest_time: 0, end_date: '' },
    { type: 'distance', distance: 1000, time: 2000, stroke_rate: 28, rest_time: 0, end_date: '' },
    { type: 'distance', distance: 500, time: 1000, stroke_rate: 32, rest_time: 0, end_date: '' },
];
const cleanName = calculateCanonicalName(cleanIntervals);
console.log(`[TEST] Clean Variable (500, 1000, 500)`);
console.log(`       EXPECTED: "v500m... Pyramid"`);
console.log(`       ACTUAL:   "${cleanName}"`);
console.log(cleanName === "v500m... Pyramid" ? "✅ PASS" : "❌ FAIL");
console.log("");

// 3. Many Intervals (Splits) - should group
const manyIntervals: C2Interval[] = Array(10).fill({ type: 'distance', distance: 500, time: 1000, rest_time: 0 });
const manyName = calculateCanonicalName(manyIntervals);
console.log(`[TEST] Many Intervals (10x500m)`);
console.log(`       EXPECTED: "10x500m"`);
console.log(`       ACTUAL:   "${manyName}"`);
console.log(manyName === "10x500m" ? "✅ PASS" : "❌ FAIL");
console.log("");
