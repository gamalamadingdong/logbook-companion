
import { createClient } from '@supabase/supabase-js';
import { calculateCanonicalName, detectIntervalsFromStrokes } from '../src/utils/workoutNaming';
import type { C2Interval } from '../src/api/concept2.types';
import fs from 'fs';
import path from 'path';

// Standard rowing distances
const STANDARD_DISTANCES = [
    100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000,
    7500, 10000, 15000, 21097, 30000, 42195
];

function roundToStandardDistance(meters: number): number {
    const threshold = Math.max(20, meters * 0.01);
    for (const standard of STANDARD_DISTANCES) {
        if (Math.abs(meters - standard) <= threshold) {
            return standard;
        }
    }
    return Math.round(meters);
}

// Load creds from .env manually (simple parsing)
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = envContent.split('\n').reduce((acc, line) => {
    const [key, val] = line.split('=');
    if (key && val) acc[key.trim()] = val.trim();
    return acc;
}, {} as Record<string, string>);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    console.error("URL:", supabaseUrl ? "✓" : "✗");
    console.error("Key:", supabaseKey ? "✓" : "✗");
    console.error("\nNOTE: This script needs VITE_SUPABASE_SERVICE_ROLE_KEY to bypass RLS policies.");
    console.error("Add it to your .env file from your Supabase dashboard (Settings > API)");
    process.exit(1);
}

console.log("Connecting to Supabase:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
    console.log("Starting Backfill of canonical_name...");

    // Fetch all workouts
    const { data: workouts, error } = await supabase
        .from('workout_logs')
        .select('*');

    if (error) {
        console.error("Error fetching workouts:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        return;
    }

    if (!workouts) {
        console.error("No data returned from query (workouts is null/undefined)");
        return;
    }

    console.log(`Found ${workouts.length} workouts to process.`);

    for (const w of workouts) {
        let canonicalName = w.workout_name; // Default to existing
        let intervals: C2Interval[] = [];
        let raw = w.raw_data;

        // Parse raw data if it's a string
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch (e) {  console.log(e);}
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
                canonicalName = `${roundToStandardDistance(w.distance_meters)}m`;
            } else if (w.workout_type === 'FixedTimeSplits' || w.workout_type === 'FixedTimeNoSplits') {
                const mins = Math.round(w.duration_minutes);
                canonicalName = `${mins}:00`;
            } else if (w.workout_type === 'JustRow' && w.distance_meters > 0) {
                canonicalName = `${roundToStandardDistance(w.distance_meters)}m JustRow`;
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
