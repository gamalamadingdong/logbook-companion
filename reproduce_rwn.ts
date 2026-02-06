import { parseRWN } from './src/utils/rwnParser';
import { calculateCanonicalName } from './src/utils/workoutNaming';
import { C2Interval } from './src/api/concept2.types';
import { WorkoutStep } from './src/types/workoutStructure.types';

const testCases = [
    "(2000m+1000m+500m)/3:00r",
    "1x(2000m+1000m+500m)/3:00r"
];

function structureToIntervals(steps: WorkoutStep[]): C2Interval[] {
    const intervals: C2Interval[] = [];

    // We need to group work + following rest?
    // The calculateCanonicalName assumes C2Intervals which have rest *inside* them (rest_time/dist).
    // The parser returns a flat list of Work, Rest, Work, Rest steps.

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.type === 'work') {
            const nextStep = steps[i + 1];
            let restTime = 0;

            if (nextStep && nextStep.type === 'rest') {
                restTime = nextStep.value;
            }

            intervals.push({
                type: step.duration_type === 'distance' ? 'distance' : 'time',
                distance: step.duration_type === 'distance' ? step.value : 0,
                time: step.duration_type === 'time' ? step.value * 10 : 0, // C2 uses deci-seconds for time
                rest_time: restTime * 10, // C2 uses deci-seconds ?? Wait, let's check types
                // Mock other fields
                stroke_rate: 0,
                watts: 0,
                calories_total: 0
            } as any);
        }
    }

    return intervals;
}

testCases.forEach(input => {
    console.log(`\n--- Testing: "${input}" ---`);
    const structure = parseRWN(input);

    if (!structure) {
        console.log("Parse Result: NULL");
        return;
    }

    console.log("Structure Type:", structure.type);
    if (structure.type === 'variable') {
        console.log("Steps:", structure.steps.map(s => `${s.type} ${s.value}${s.duration_type === 'distance' ? 'm' : 's'}`).join(', '));
        console.log("Raw object:", JSON.stringify(structure.steps, null, 2));

        const intervals = structureToIntervals(structure.steps);
        console.log("Converted Intervals:", intervals.length);
        console.log("Interval 0 Rest:", intervals[0]?.rest_time);
        console.log("Interval 1 Rest:", intervals[1]?.rest_time);
        console.log("Interval 2 Rest:", intervals[2]?.rest_time);

        const name = calculateCanonicalName(intervals);
        console.log("Canonical Name:", name);
    } else if (structure.type === 'interval') {
        console.log("Interval:", structure.repeats, "x", structure.work.value, structure.work.type, "/", structure.rest.value, "rest");
    }
});
