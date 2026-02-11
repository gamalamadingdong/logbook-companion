import { useState, useCallback } from 'react';
import { getProfile, getResults, getResultDetail, getStrokes } from '../api/concept2';
import type { C2Interval, C2Result } from '../api/concept2.types';
import { supabase, upsertWorkout } from '../services/supabase';
import type { WorkoutLog } from '../services/supabase';
import { workoutService } from '../services/workoutService';
import { calculateZoneDistribution } from '../utils/zones';
import { calculatePowerBuckets } from '../utils/powerBucketing';
import { calculateCanonicalName, roundToStandardDistance } from '../utils/workoutNaming';
import { saveFilteredPRs } from '../utils/prDetection';
import { matchWorkoutToTemplate } from '../utils/templateMatching';
import { findMatchingWorkout, shouldUpgrade } from '../utils/reconciliation';

export type SyncRange = 'all' | 'season' | '30days' | 'custom';

export interface SyncOptions {
    range: SyncRange;
    startDate?: Date | null;
    endDate?: Date | null;
    forceResync?: boolean;
    machineTypes?: Record<string, boolean>;
    skipIfRecent?: boolean; // New option
}

export const useConcept2Sync = () => {
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const findSupabaseUser = async (email: string) => {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('email', email)
            .single();

        if (error || !data) {
            console.error("User lookup failed:", error);
            return null;
        }
        return data.user_id;
    };

    const startSync = useCallback(async (options: SyncOptions = { range: '30days' }) => {
        // Smart Sync Throttling
        if (options.skipIfRecent) {
            const lastSync = localStorage.getItem('last_c2_sync_timestamp');
            if (lastSync) {
                const diff = Date.now() - parseInt(lastSync, 10);
                const oneHour = 60 * 60 * 1000;
                if (diff < oneHour) {
                    console.log(`Skipping sync. Last sync was ${Math.round(diff / 60000)} minutes ago.`);
                    return; // Silently skip
                }
            }
        }

        setSyncing(true);
        setError(null);
        setStatus('Initializing sync...');
        setProgress(0);

        try {
            // 1. Get C2 Profile & Match to Supabase User
            setStatus('Matching user profile...');
            const profile = await getProfile();
            console.log('C2 Profile:', profile);

            const userId = await findSupabaseUser(profile.email);
            if (!userId) {
                throw new Error(`Could not find a Supabase user for email: ${profile.email}. Please ensure your "Logbook Companion" account email matches your Concept2 logbook email.`);
            }
            console.log('Matched Supabase User:', userId);

            // 1b. Get Baseline for ongoing calculations
            const { data: baseline } = await supabase
                .from('user_baseline_metrics')
                .select('pr_2k_watts')
                .eq('user_id', userId)
                .single();
            const baseWatts = baseline?.pr_2k_watts || 202;

            // 2. Fetch C2 Workouts (Pagination Loop with Filters)
            setStatus('Fetching workout history from Concept2...');

            // Calculate Date Params
            const queryParams: Record<string, string> = {};
            if (options.range === '30days') {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                queryParams.from = d.toISOString().split('T')[0];
            } else if (options.range === 'season') {
                const now = new Date();
                const currentYear = now.getFullYear();
                // Season starts May 1st. If before May, season started prev year.
                const seasonStartYear = now.getMonth() < 4 ? currentYear - 1 : currentYear;
                queryParams.from = `${seasonStartYear}-05-01`;
            } else if (options.range === 'custom' && options.startDate && options.endDate) {
                queryParams.from = options.startDate.toISOString().split('T')[0];
                queryParams.to = options.endDate.toISOString().split('T')[0];
            }
            // 'all' sends no params

            let allSummaries: C2Result[] = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                setStatus(`Fetching page ${page}... ${queryParams.from ? `(since ${queryParams.from})` : ''}`);
                const response = await getResults('me', page, queryParams);
                const pageData = Array.isArray(response.data) ? response.data : [];

                if (pageData.length === 0) {
                    hasMore = false;
                } else {
                    allSummaries = [...allSummaries, ...pageData];
                    page++;
                }
            }

            if (allSummaries.length === 0) {
                setStatus('No workouts found.');
                localStorage.setItem('last_c2_sync_timestamp', Date.now().toString()); // Save even if 0 found, it was a success
                setSyncing(false);
                return;
            }

            setStatus(`Processing ${allSummaries.length} workouts...`);

            // 2b. Optimize: Fetch existing IDs to avoid re-processing
            setStatus('Checking existing database records...');
            const { data: existingRecords } = await supabase
                .from('workout_logs')
                .select('external_id')
                .eq('user_id', userId);

            const existingIds = new Set(existingRecords?.map(r => r.external_id) || []);
            console.log(`Found ${existingIds.size} existing workouts in DB.`);

            // 3. Process & Upsert
            let processed = 0;
            let skippedExisting = 0;
            let skippedFiltered = 0;
            let failed = 0;

            // Default machine types if not provided
            const machineTypes = options.machineTypes || { 'rower': true, 'bike': true, 'skierg': true };

            const totalToProcess = allSummaries.length;

            for (let i = 0; i < allSummaries.length; i++) {
                const summary = allSummaries[i];
                const currentIndex = i + 1;

                // Update progress bar
                setProgress(Math.round((currentIndex / totalToProcess) * 100));

                // FILTER: Check Machine Type FIRST (before API calls)
                const type = summary.type || 'rower'; // Default to rower if missing
                if (!machineTypes[type]) {
                    skippedFiltered++;
                    setStatus(`Processing ${currentIndex}/${totalToProcess} (${processed} synced, ${skippedExisting} existing, ${skippedFiltered} filtered)`);
                    continue;
                }

                // SKIP if already exists (unless Forced)
                if (!options.forceResync && existingIds.has(summary.id.toString())) {
                    skippedExisting++;
                    setStatus(`Processing ${currentIndex}/${totalToProcess} (${processed} synced, ${skippedExisting} existing, ${skippedFiltered} filtered)`);
                    continue;
                }

                try {
                    // Fetch full details (strokes, splits)
                    const detail = await getResultDetail(summary.id);
                    const strokes = await getStrokes(summary.id);

                    const fullData = {
                        ...detail,
                        strokes
                    };

                    // Granular Calc
                    const distribution = calculateZoneDistribution(fullData, baseWatts);

                    // Map to DB Schema
                    const record: Partial<WorkoutLog> & { id?: string } = {
                        external_id: summary.id.toString(),
                        user_id: userId,
                        workout_name: summary.workout_type || 'Workout',
                        workout_type: summary.type || 'rower',
                        completed_at: summary.date,
                        distance_meters: summary.distance,
                        rest_distance_meters: summary.rest_distance || detail.rest_distance,
                        duration_minutes: Math.round(summary.time / 600),
                        duration_seconds: summary.time / 10,
                        watts: summary.watts ? Math.round(summary.watts) : undefined,
                        average_stroke_rate: summary.stroke_rate ? Math.round(summary.stroke_rate) : undefined,
                        calories_burned: detail.calories_total,
                        average_heart_rate: detail.heart_rate?.average,
                        max_heart_rate: detail.heart_rate?.max,
                        source: 'concept2',
                        notes: `RWN: ${(() => {
                            const calculated = calculateCanonicalName(fullData.workout?.intervals || []);
                            if (calculated && calculated !== 'Unknown') return calculated;

                            // Shared Fallback Logic
                            const type = summary.workout_type || '';
                            if (['FixedDistanceSplits', 'FixedDistanceNoSplits', 'FixedDistanceInterval'].includes(type) || type === 'DistanceInterval') {
                                return `${roundToStandardDistance(summary.distance)}m`;
                            }
                            if (['FixedTimeSplits', 'FixedTimeNoSplits', 'FixedTimeInterval'].includes(type) || type === 'TimeInterval') {
                                const mins = Math.round(summary.time / 600);
                                return `${mins}:00`;
                            }
                            if (['FixedCalorie', 'FixedCalorieInterval', 'FixedCalorieSplits', 'FixedCalorieNoSplits'].includes(type) || type === 'CalorieInterval') {
                                return `${detail.calories_total} cal`;
                            }
                            if (['FixedWattMinute', 'FixedWattMinuteInterval', 'FixedWattSplits', 'FixedWattNoSplits'].includes(type) || type === 'WattInterval' || type === 'WattsInterval') {
                                return `${Math.round(summary.watts || 0)}W`;
                            }
                            if (type === 'JustRow' || type.includes('Just Row')) {
                                return `${Math.floor(summary.distance)}m JustRow`;
                            }
                            // Default to calculated (even if Unknown) or Type
                            return calculated !== 'Unknown' ? calculated : (summary.workout_type || 'Workout');
                        })()}`,
                        raw_data: fullData,
                        zone_distribution: distribution,
                        canonical_name: (() => {
                            const calculated = calculateCanonicalName(fullData.workout?.intervals || []);
                            if (calculated && calculated !== 'Unknown') return calculated;

                            // Fallback logic with standard distance rounding
                            const type = summary.workout_type || '';

                            if (['FixedDistanceSplits', 'FixedDistanceNoSplits', 'FixedDistanceInterval'].includes(type) || type === 'DistanceInterval') {
                                return `${roundToStandardDistance(summary.distance)}m`;
                            }
                            if (['FixedTimeSplits', 'FixedTimeNoSplits', 'FixedTimeInterval'].includes(type) || type === 'TimeInterval') {
                                const mins = Math.round(summary.time / 600);
                                return `${mins}:00`;
                            }
                            if (['FixedCalorie', 'FixedCalorieInterval', 'FixedCalorieSplits', 'FixedCalorieNoSplits'].includes(type) || type === 'CalorieInterval') {
                                return `${detail.calories_total} cal`;
                            }
                            if (['FixedWattMinute', 'FixedWattMinuteInterval', 'FixedWattSplits', 'FixedWattNoSplits'].includes(type) || type === 'WattInterval' || type === 'WattsInterval') {
                                return `${Math.round(summary.watts || 0)}W`;
                            }
                            if (type === 'JustRow' || type.includes('Just Row')) {
                                return `${Math.floor(summary.distance)}m JustRow`;
                            }
                            return calculated;
                        })(),
                        avg_split_500m: (() => {
                            // Calculate Average Split (Seconds per 500m)
                            // Time is in deciseconds
                            const seconds = summary.time / 10;
                            const meters = summary.distance;
                            if (meters > 0) {
                                const val = (seconds / meters) * 500;
                                return Math.min(val, 999.9); // Clamp to DB numeric(5,2) limit
                            }
                            return undefined;
                        })()
                    };

                    // RECONCILIATION: Check for existing manual/other entries to upgrade
                    const match = await findMatchingWorkout(supabase, {
                        userId,
                        date: new Date(summary.date),
                        distance: summary.distance,
                        timeSeconds: summary.time / 10,
                        tolerance: {
                            timeSeconds: 60 * 10, // +/- 10 mins matching window
                            distanceMeters: 100,  // +/- 100m tolerance (generous for manual entry error)
                            durationSeconds: 10   // +/- 10s tolerance
                        }
                    });

                    if (match) {
                        if (shouldUpgrade(match.source, 'concept2')) {
                            console.log(`Reconciliation: Upgrading workout ${match.id} from ${match.source} to concept2`);
                            record.id = match.id; // OVERRIDE existing row
                        } else {
                            console.log(`Reconciliation: Skipping workout. Existing source ${match.source} is higher/equal priority.`);
                            skippedExisting++;
                            continue; // Logic says we don't need to sync this if we have better data
                        }
                    }

                    // Fallback for Watts if missing (Estimate from Pace)
                    if (!record.watts && record.avg_split_500m) {
                        // Power = 2.80 * (velocity ^ 3)
                        // Velocity = 500 / Pace
                        const velocity = 500 / record.avg_split_500m;
                        const calculated = Math.round(2.80 * Math.pow(velocity, 3));
                        record.watts = Math.min(calculated, 3000);
                    }

                    const upsertedWorkout = await upsertWorkout(record);

                    // Auto-match workout to template by canonical_name
                    if (upsertedWorkout && upsertedWorkout.length > 0 && record.canonical_name) {
                        const workoutId = upsertedWorkout[0].id;
                        const templateId = await matchWorkoutToTemplate(workoutId, userId, record.canonical_name);

                        // 3a. Assignment Linking
                        // If we matched a template, try to complete an assignment
                        // Wrap in Try/Catch so this never fails the sync if schema is outdated (e.g. missing columns)
                        try {
                            if (templateId) {
                                const dateStr = new Date(summary.date).toISOString().split('T')[0];
                                const { data: assignment } = await supabase
                                    .from('daily_workout_assignments')
                                    .select('id')
                                    .eq('user_id', userId)
                                    .eq('workout_date', dateStr)
                                    .eq('original_template_id', templateId)
                                    .eq('completed', false)
                                    .maybeSingle();

                                if (assignment) {
                                    await supabase
                                        .from('daily_workout_assignments')
                                        .update({
                                            completed: true,
                                            completed_log_id: workoutId,
                                            completed_at: new Date().toISOString()
                                        })
                                        .eq('id', assignment.id);
                                    console.log(`Linked workout ${workoutId} to assignment ${assignment.id}`);
                                }
                            }
                        } catch (assignErr) {
                            console.warn('Assignment linking skipped:', assignErr);
                        }

                        // 3b. Power Distribution (Histograms) - Work Strokes Only
                        try {
                            // fullData contains 'strokes' and typically 'workout.intervals'
                            const fullDataRecord = fullData as Record<string, unknown>;
                            const nestedData = fullDataRecord.data as Record<string, unknown> | undefined;
                            const nestedIntervals = Array.isArray(nestedData?.intervals)
                                ? (nestedData?.intervals as C2Interval[])
                                : undefined;
                            const intervals = fullData.workout?.intervals ?? nestedIntervals;
                            if (fullData.strokes && fullData.strokes.length > 0) {
                                const buckets = calculatePowerBuckets(fullData.strokes, intervals);
                                await workoutService.savePowerDistribution(workoutId, buckets);
                            }
                        } catch (bucketErr) {
                            console.warn(`Failed to calculate/save power buckets for ${summary.id}`, bucketErr);
                            // Non-fatal, continue
                        }
                    }

                    processed++;
                    setStatus(`Processing ${currentIndex}/${totalToProcess} (${processed} synced, ${skippedExisting} existing, ${skippedFiltered} filtered)`);

                    // Rate Limit Throttle: Wait 500ms between API calls to be polite
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (innerErr) {
                    console.error(`Failed to process workout ${summary.id}:`, innerErr);
                    failed++;
                    setStatus(`Processing ${currentIndex}/${totalToProcess} (${processed} synced, ${skippedExisting} existing, ${skippedFiltered} filtered, ${failed} failed)`);
                    // Just continue to next
                }
            }

            // 4. Update PR Cache
            setStatus('Updating Personal Records...');
            setProgress(100);
            await saveFilteredPRs(userId);

            const failureMsg = failed > 0 ? `, ${failed} failed` : '';
            const filterMsg = skippedFiltered > 0 ? `, ${skippedFiltered} filtered by machine type` : '';
            setStatus(`Success! Synced ${processed} new workouts (${skippedExisting} already existed${filterMsg}${failureMsg}).`);

            // SAVE LOCALSTORAGE TIMESTAMP
            localStorage.setItem('last_c2_sync_timestamp', Date.now().toString());

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Sync failed.");
            setStatus('Sync failed.');
        } finally {
            setSyncing(false);
        }
    }, []);

    return {
        syncing,
        progress,
        status,
        error,
        startSync
    };
};
