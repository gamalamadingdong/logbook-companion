
import { calculateCanonicalName } from '../src/utils/prCalculator';

// Mock Interval Data for 750/500/250 x 3
const createInterval = (dist: number) => ({
    type: 'distance',
    distance: dist,
    time: 100, // Dummy
    rest_time: 1800, // 3 mins
    stroke_rate: 26,
    calories_total: 50,
    watts: 200
});

const variablePattern = [750, 500, 250];
const intervals = [
    ...variablePattern,
    ...variablePattern,
    ...variablePattern
].map(d => createInterval(d));

console.log("Input Intervals:", intervals.map(i => i.distance));
const name = calculateCanonicalName(intervals as any);
console.log(`Calculated Name: "${name}"`);

if (name === 'Unstructured') {
    console.log("FAIL: Workout labeled as Unstructured");
} else if (name.includes('v750') || name.includes('3x')) {
    console.log("SUCCESS: Workout identified correctly");
} else {
    console.log("UNKNOWN OUTPUT");
}
