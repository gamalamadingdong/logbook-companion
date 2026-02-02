
import { createClient } from '@supabase/supabase-js';
import { calculateCanonicalName, detectIntervalsFromStrokes } from '../src/utils/prCalculator';
import type { C2ResultDetail, C2Interval } from '../src/api/concept2.types';
import fs from 'fs';
import path from 'path';

// Load creds from .env manually (simple parsing)
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = envContent.split('\n').reduce((acc, line) => {
    const [key, val] = line.split('=');
    if (key && val) acc[key.trim()] = val.trim();
    return acc;
}, {} as Record<string, string>);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
    console.log("Starting Backfill of canonical_name...");

    // Fetch all workouts
    const { data: workouts, error } = await supabase
        .from('workout_logs')
        .select('*');

    if (error) {
        console.error("Error fetching workouts:", error);
        return;
    }

    console.log(`Found ${workouts.length} workouts to process.`);

    for (const w of workouts) {
        let canonicalName = w.workout_name; // Default to existing
        let intervals: C2Interval[] = [];
        let raw = w.raw_data;

        // Parse raw data if it's a string
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch (e) { }
        }

        // Extract intervals
        if (raw?.workout?.intervals) {
            intervals = raw.workout.intervals;
        } else if (raw?.strokes) {
            intervals = detectIntervalsFromStrokes(raw.strokes);
        }

        // Generate Canonical Name
        if (intervals.length > 0) {
            const generated = calculateCanonicalName(intervals);
            if (generated && generated !== 'Unknown') {
                canonicalName = generated;
            }
        } else {
            // Fallback logic for single distance/time if needed, 
            // but usually 'FixedDistanceSplits' etc are okay if no intervals?
            // Actually, if it's FixedDistance, we might want "5000m" instead of "FixedDistanceSplits"
            // calculateCanonicalName usually returns 'Unknown' or specific interval names.
            // Let's rely on simple checks for FixedDistance/FixedTime if they aren't intervals.

            if (w.workout_type === 'FixedDistanceSplits' || w.workout_type === 'FixedDistanceNoSplits') {
                canonicalName = `${w.distance_meters}m`;
            } else if (w.workout_type === 'FixedTimeSplits' || w.workout_type === 'FixedTimeNoSplits') {
                const mins = Math.round(w.duration_minutes);
                canonicalName = `${mins}:00`;
            } else if (w.workout_type === 'JustRow' && w.distance_meters > 0) {
                canonicalName = `${Math.floor(w.distance_meters)}m JustRow`;
            }
        }

        // Update if different
        if (canonicalName !== w.canonical_name) {
            console.log(`Updating ${w.id}: ${w.workout_name} -> ${canonicalName}`);
            const { error: updateError } = await supabase
                .from('workout_logs')
                .update({ canonical_name: canonicalName })
                .eq('id', w.id);

            if (updateError) {
                console.error(`Failed to update ${w.id}:`, updateError);
            }
        }
    }
    console.log("Backfill Complete.");
}

backfill();
