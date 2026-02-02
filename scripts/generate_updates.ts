
import fs from 'fs';
import path from 'path';
import { calculateCanonicalName, detectIntervalsFromStrokes } from '../src/utils/prCalculator';
import type { C2Interval } from '../src/api/concept2.types';

const inputFile = path.resolve(process.cwd(), 'temp_workouts.json');
const outputFile = path.resolve(process.cwd(), 'temp_updates.sql');

const content = fs.readFileSync(inputFile, 'utf-8');
const workouts = JSON.parse(content);

console.log(`Processing ${workouts.length} workouts...`);

let sql = '';

for (const w of workouts) {
    let canonicalName = w.workout_name;
    let intervals: C2Interval[] = [];
    let raw = w.raw_data;

    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (e) { }
    }

    if (raw?.workout?.intervals) {
        intervals = raw.workout.intervals;
    } else if (raw?.strokes) {
        intervals = detectIntervalsFromStrokes(raw.strokes);
    }
    else if (w.intervals) { // Handle direct intervals from SQL if extracted
        intervals = w.intervals;
    }

    if (intervals.length > 0) {
        const generated = calculateCanonicalName(intervals);
        if (generated && generated !== 'Unknown') {
            canonicalName = generated;
        }
    } else {
        if (w.workout_type === 'FixedDistanceSplits' || w.workout_type === 'FixedDistanceNoSplits') {
            canonicalName = `${w.distance_meters}m`;
        } else if (w.workout_type === 'FixedTimeSplits' || w.workout_type === 'FixedTimeNoSplits') {
            const mins = Math.round(w.duration_minutes);
            canonicalName = `${mins}:00`;
        } else if (w.workout_type === 'JustRow' && w.distance_meters > 0) {
            canonicalName = `${Math.floor(w.distance_meters)}m JustRow`;
        }
    }

    // Escape single quotes for SQL
    const safeName = canonicalName ? canonicalName.replace(/'/g, "''") : '';

    if (safeName) {
        sql += `UPDATE workout_logs SET canonical_name = '${safeName}' WHERE id = '${w.id}';\n`;
    }
}

fs.writeFileSync(outputFile, sql);
console.log(`Generated SQL updates in ${outputFile}`);
