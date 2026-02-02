
import { calculateCanonicalName } from '../src/utils/prCalculator';

console.log("Using Mock Intervals based on user report: 3 sets of 750/500/250");

// MOCK DATA based on User Description: 750/500/250 x 3
// 3x (750m, 500m, 250m) with rest
const variablePattern = [750, 500, 250];

// Create 3 sets
let intervals: any[] = [];
for (let i = 0; i < 3; i++) {
    variablePattern.forEach(dist => {
        intervals.push({
            type: 'distance',
            distance: dist,
            time: dist * 2, // Dummy time
            rest_time: 0 // In C2 intervals, rest is often separate or attached.
        });
    });
}

console.log(`Extracted ${intervals.length} intervals:`);
intervals.forEach((i: any, idx: number) => {
    console.log(`  [${idx}] ${i.type} Dist: ${i.distance}m`);
});

const name = calculateCanonicalName(intervals);
console.log("\nCalculated Name:", name);
