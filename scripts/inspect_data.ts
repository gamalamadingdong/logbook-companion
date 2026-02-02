
import fs from 'fs';
import path from 'path';

const files = [
    'db/3x12min.json',
    'db/speedPyramid.json'
];

files.forEach(file => {
    const p = path.join(process.cwd(), file);
    if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        try {
            const json = JSON.parse(content);
            const workout = json[0];
            const rawData = JSON.parse(workout.raw_data);

            console.log(`\n--- ${file} ---`);
            console.log("Keys in raw_data:", Object.keys(rawData));
            if (rawData.workout) {
                console.log("Keys in raw_data.workout:", Object.keys(rawData.workout));
                if (rawData.workout.intervals) {
                    console.log(`Found ${rawData.workout.intervals.length} intervals.`);
                    console.log("Sample Interval:", rawData.workout.intervals[0]);
                } else {
                    console.log("No intervals in raw_data.workout");
                }
            } else {
                console.log("No 'workout' key in raw_data");
                // Check if intervals exist at top level?
                if (rawData.intervals) {
                    console.log(`Found ${rawData.intervals.length} intervals (top-level).`);
                    console.log("Sample Interval:", rawData.intervals[0]);
                }
            }
        } catch (e) {
            console.error(`Error parsing ${file}:`, e);
        }
    } else {
        console.error(`File not found: ${file}`);
    }
});
