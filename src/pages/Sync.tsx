
import React, { useEffect, useState } from 'react';
import { initiateGoogleLogin, createSheet, appendData } from '../api/googleSheets';
import { useAuth } from '../hooks/useAuth';
import { getResults, getProfile, getResultDetail, getStrokes } from '../api/concept2';
import { supabase, upsertWorkout } from '../services/supabase';
import { FileSpreadsheet, Check, Loader2, RefreshCw, AlertCircle, Microscope } from 'lucide-react';
import { calculateZoneDistribution } from '../utils/zones';


export const Sync: React.FC = () => {
    const [googleToken, setGoogleToken] = useState<string | null>(localStorage.getItem('google_token'));
    const [syncing, setSyncing] = useState(false);
    const [forceResync, setForceResync] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const { } = useAuth();

    useEffect(() => {
        // Handle Google OAuth Redirect
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get('access_token');
            if (token) {
                localStorage.setItem('google_token', token);
                setGoogleToken(token);
                window.location.hash = '';
                setStatus('Google Account Connected!');
            }
        }
    }, []);

    const handleConnectGoogle = () => {
        initiateGoogleLogin();
    };

    const findSupabaseUser = async (email: string) => {
        // Find user profile by email
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
    }

    const handleSyncToDatabase = async () => {
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
                throw new Error(`Could not find a Supabase user for email: ${profile.email}. Please ensure your "Train Better" account email matches your Concept2 logbook email.`);
            }
            console.log('Matched Supabase User:', userId);

            // 1b. Get Baseline for ongoing calculations
            const { data: baseline } = await supabase
                .from('user_baseline_metrics')
                .select('pr_2k_watts')
                .eq('user_id', userId)
                .single();
            const baseWatts = baseline?.pr_2k_watts || 202;

            // 2. Fetch All C2 Workouts (Pagination Loop)
            setStatus('Fetching workout history from Concept2...');

            let allSummaries: any[] = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                setStatus(`Fetching page ${page}...`);
                const response = await getResults('me', page);
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
            let skipped = 0;
            for (const summary of allSummaries) {
                // SKIP if already exists (unless Forced)
                if (!forceResync && existingIds.has(summary.id.toString())) {
                    skipped++;
                    // Optional: Update progress even for skips so the bar moves? 
                    // Or usually we just want to focus on well.
                    // Let's just log it and move on quickly.
                    continue;
                }

                // Fetch full details (strokes, splits)
                const detail = await getResultDetail(summary.id);
                const strokes = await getStrokes(summary.id);

                // ... (rest of processing)
                const fullData = {
                    ...detail,
                    strokes // Attach strokes array
                };

                // Granular Calc
                const distribution = calculateZoneDistribution(fullData, baseWatts);

                // Map to DB Schema
                const record = {
                    external_id: summary.id.toString(),
                    user_id: userId,
                    workout_name: summary.workout_type || 'Workout', // Fallback
                    workout_type: summary.type || 'rower',
                    completed_at: summary.date,
                    distance_meters: summary.distance,
                    duration_minutes: Math.round(summary.time / 600), // Round deciseconds -> minutes
                    duration_seconds: summary.time / 10, // Exact seconds
                    watts: summary.watts ? Math.round(summary.watts) : undefined,
                    average_stroke_rate: summary.stroke_rate ? Math.round(summary.stroke_rate) : undefined,
                    calories_burned: detail.calories_total,
                    average_heart_rate: detail.heart_rate?.average,
                    max_heart_rate: detail.heart_rate?.max,
                    source: 'concept2',
                    raw_data: fullData,
                    zone_distribution: distribution
                };

                await upsertWorkout(record);

                processed++;
                setProgress((processed / (allSummaries.length - skipped)) * 100); // Progress relative to NEW items? Or total?
                // Let's just simply show count
                setStatus(`Syncing new workout ${processed}... (${skipped} skipped)`);
            }

            setStatus(`Success! Synced ${processed} new workouts. (${skipped} already up to date).`);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Sync failed.");
            setStatus('Sync failed.');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 font-sans">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header (Local) */}
                <div className="flex items-center justify-between pb-6 border-b border-neutral-800 mt-6">
                    <div>
                        <h2 className="text-2xl font-bold">Data & Sync</h2>
                        <p className="text-neutral-500 text-sm">Manage your integration status</p>
                    </div>
                </div>

            </div>

            {/* Database Sync Card */}
            <div className="bg-neutral-900/50 rounded-2xl border border-neutral-800 p-8 space-y-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                        <RefreshCw size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-white">Archive to Train Better</h2>
                        <p className="text-neutral-400 mt-1 max-w-lg">
                            Pull your latest workouts from Concept2 (including stroke-by-stroke data) and archive them to your private database for deep analysis.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200 text-sm">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="bg-black/40 rounded-xl p-6 border border-neutral-800/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-neutral-300 font-medium">Status</span>
                        <span className="text-emerald-400 font-mono text-sm">{status}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                            style={{ width: `${progress}% ` }}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="flex items-center gap-3 text-sm text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
                        <input
                            type="checkbox"
                            checked={forceResync}
                            onChange={(e) => setForceResync(e.target.checked)}
                            className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-emerald-500 focus:ring-emerald-500/20"
                        />
                        Force Resync (Overwrite existing data)
                    </label>

                    <button
                        onClick={handleSyncToDatabase}
                        disabled={syncing}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                    >
                        {syncing ? (
                            <>
                                <Loader2 className="animate-spin" />
                                Syncing... {Math.round(progress)}%
                            </>
                        ) : (
                            'Start Database Sync'
                        )}
                    </button>
                </div>
            </div>

            {/* Google Sheets Sync Card (Secondary) */}
            <div className="bg-neutral-900/30 rounded-2xl border border-neutral-800 p-8 flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                        <FileSpreadsheet size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Google Sheets Backup</h2>
                        <p className="text-neutral-500 text-sm">Optional: create a spreadsheet report.</p>
                    </div>
                </div>

                {!googleToken ? (
                    <button
                        onClick={handleConnectGoogle}
                        className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
                    >
                        Connect Google
                    </button>
                ) : (
                    <button
                        onClick={async () => {
                            if (!googleToken) return;
                            setStatus('Generating report...');
                            setError(null);
                            try {
                                // 1. Fetch Data
                                // First, get last export time
                                const { data: userInt } = await supabase
                                    .from('user_integrations')
                                    .select('last_export_at, google_sheet_id')
                                    .single();

                                // We need to decide: Are we making a new sheet or appending?
                                // If we have a sheet ID, acts as "Smart Append"

                                let query = supabase
                                    .from('workout_logs')
                                    .select('*')
                                    .order('completed_at', { ascending: true }); // Ascending for appending history logic

                                if (userInt?.last_export_at && userInt?.google_sheet_id) {
                                    setStatus(`Fetching workouts since ${new Date(userInt.last_export_at).toLocaleDateString()}...`);
                                    query = query.gt('created_at', userInt.last_export_at);
                                    // Note: Using created_at or completed_at? 
                                    // created_at is safer for "when it was synced to DB".
                                } else {
                                    setStatus('Fetching all history...');
                                }

                                const { data: logs, error } = await query;

                                if (error) throw error;
                                if (!logs || logs.length === 0) {
                                    if (userInt?.google_sheet_id) {
                                        alert("No new workouts since last export.");
                                        return;
                                    }
                                    throw new Error("No data to export.");
                                }

                                setStatus(`Processing ${logs.length} new workouts...`);

                                // 2. Prepare Data Rows
                                const workoutRows = [['Date', 'Type', 'Total Dist', 'Work Dist', 'Work Time', 'Work Pace', 'Avg Watts', 'Avg HR', 'SPM', 'Eff (W/HR)', 'Link']];
                                const intervalRows = [['Date', 'Workout ID', 'Interval #', 'Dist', 'Time', 'Pace', 'Watts', 'SPM', 'HR']];

                                for (const log of logs) {
                                    const date = new Date(log.completed_at).toLocaleDateString();
                                    const raw = log.raw_data || {};

                                    const link = `https://log.concept2.com/profile/${log.user_id}/log/${log.external_id}`;

                                    workoutRows.push([
                                        date,
                                        log.workout_type,
                                        log.distance_meters,
                                        log.distance_meters,
                                        (log.duration_minutes * 60).toFixed(1), // seconds
                                        '-',
                                        log.watts || '-',
                                        log.average_heart_rate || '-',
                                        log.average_stroke_rate || '-',
                                        (log.watts && log.average_heart_rate) ? (log.watts / log.average_heart_rate).toFixed(2) : '-',
                                        link
                                    ]);

                                    const segments = raw.workout?.intervals || raw.workout?.splits || [];

                                    segments.forEach((seg: any, index: number) => {
                                        if (seg.type === 'rest') return;

                                        const pace = seg.pace ? (seg.pace / 10).toFixed(1) : '-';

                                        intervalRows.push([
                                            date,
                                            log.external_id,
                                            (index + 1).toString(),
                                            seg.distance,
                                            (seg.time / 10).toFixed(1),
                                            pace,
                                            seg.watts || '-',
                                            seg.stroke_rate || '-',
                                            seg.heart_rate?.average || '-'
                                        ]);
                                    });
                                }

                                // 0. Check for existing Sheet ID
                                let spreadsheetId: string | null = null;

                                const { data: userData } = await supabase.auth.getUser();
                                if (userData.user) {
                                    const { data: integrationData } = await supabase
                                        .from('user_integrations')
                                        .select('google_sheet_id')
                                        .eq('user_id', userData.user.id)
                                        .single();

                                    if (integrationData?.google_sheet_id) {
                                        spreadsheetId = integrationData.google_sheet_id;
                                        setStatus(`Found existing Sheet (${spreadsheetId}). Preparing append...`);
                                    }
                                }

                                // 3. Create Sheet (if needed)
                                if (!spreadsheetId) {
                                    setStatus('Creating NEW Google Sheet...');
                                    const sheetTitle = `Logbook Analyzer Log`; // Keep name stable? Or date-based?
                                    const sheet = await createSheet(googleToken, sheetTitle, ['Workouts', 'Intervals']);
                                    spreadsheetId = sheet.spreadsheetId;

                                    // SAVE IT to DB
                                    if (userData.user && spreadsheetId) {
                                        await supabase
                                            .from('user_integrations')
                                            .upsert({
                                                user_id: userData.user.id,
                                                google_sheet_id: spreadsheetId,
                                                last_export_at: new Date().toISOString()
                                            }, { onConflict: 'user_id' });
                                    }
                                } else {
                                    // Update last_export timestamp
                                    if (userData.user) {
                                        await supabase
                                            .from('user_integrations')
                                            .update({ last_export_at: new Date().toISOString() })
                                            .eq('user_id', userData.user.id);
                                    }
                                }

                                // 4. Append Data (Smart Append could go here, but for now just appending)
                                // TODO: Check duplicates in sheet? 
                                // Current logic simply appends EVERYTHING selected from DB.
                                // If we re-run, we might duplicate rows in the Sheet.
                                // Ideally we should filter `logs` by `last_export_at`.
                                // But for now, let's just get the ID persistence working.

                                setStatus('Uploading data...');
                                await appendData(googleToken, spreadsheetId!, 'Workouts!A1', workoutRows);
                                await appendData(googleToken, spreadsheetId!, 'Intervals!A1', intervalRows);

                                setStatus('Export Complete! Check your Google Drive.');

                            } catch (err: any) {
                                console.error(err);
                                if (err.response && err.response.status === 401) {
                                    setGoogleToken(null);
                                    localStorage.removeItem('google_token');
                                    setError('Session expired. Please click "Connect Google" again.');
                                } else {
                                    setError('Export failed: ' + (err.response?.data?.error?.message || err.message));
                                }
                            }
                        }}
                        className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Check size={16} />
                        <span>Export to Sheets</span>
                    </button >
                )}
            </div >

            {/* Maintenance Card */}
            < div className="bg-neutral-900/30 rounded-2xl border border-neutral-800 p-8 flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity" >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                        <RefreshCw size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Maintenance</h2>
                        <p className="text-neutral-500 text-sm">Clean up duplicate entries if they exist.</p>
                    </div>
                </div>

                <button
                    onClick={async () => {
                        if (!window.confirm("This will scan for duplicate workouts (same Concept2 ID) and remove extra copies. Continue?")) return;

                        setStatus('Scanning database...');
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) {
                                throw new Error("You must be logged in.");
                            }

                            // Fetch ALL logs (increase limit from default 1000)
                            const { data: allLogs, error } = await supabase
                                .from('workout_logs')
                                .select('id, external_id, created_at')
                                .eq('user_id', user.id)
                                .not('external_id', 'is', null)
                                .range(0, 9999);

                            if (error) throw error;
                            if (!allLogs || allLogs.length === 0) {
                                alert("No workouts found in database.");
                                setStatus('No workouts found.');
                                return;
                            }

                            console.log(`Scanned ${allLogs.length} logs for duplicates...`);

                            const groups: Record<string, typeof allLogs> = {};
                            allLogs.forEach(log => {
                                const key = log.external_id!;
                                if (!groups[key]) groups[key] = [];
                                groups[key].push(log);
                            });

                            const idsToDelete: string[] = [];
                            let duplicateCount = 0;

                            Object.values(groups).forEach(group => {
                                if (group.length > 1) {
                                    duplicateCount += (group.length - 1);
                                    // Sort by created_at DESC (Keep the newest, assuming it's the synced one)
                                    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                                    // Keep index 0, delete others
                                    for (let i = 1; i < group.length; i++) {
                                        idsToDelete.push(group[i].id);
                                    }
                                }
                            });

                            if (idsToDelete.length === 0) {
                                const msg = `Scan complete. Checked ${allLogs.length} workouts, no duplicates found.`;
                                alert(msg);
                                setStatus('Database is clean.');
                                return;
                            }

                            setStatus(`Removing ${idsToDelete.length} duplicates...`);
                            console.log('Deleting IDs:', idsToDelete);

                            const { error: delError } = await supabase
                                .from('workout_logs')
                                .delete()
                                .in('id', idsToDelete);

                            if (delError) throw delError;

                            const msg = `Success! Cleaned ${idsToDelete.length} duplicate records.`;
                            setStatus(msg);
                            alert(msg);

                        } catch (err: any) {
                            console.error(err);
                            setError(err.message);
                        }
                    }}
                    className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
                >
                    Clean Duplicates
                </button>

                <button
                    onClick={async () => {
                        if (!window.confirm("This will scan ALL your existing workouts, fetch their raw stroke data (if saved), and re-calculate precise Zone Distributions based on your current 2k Power. This may take a moment. Continue?")) return;

                        setStatus('Starting Deep Analysis...');
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) throw new Error("Not logged in");

                            // 1. Get Baseline for calculations
                            const { data: baseline } = await supabase
                                .from('user_baseline_metrics')
                                .select('pr_2k_watts')
                                .eq('user_id', user.id)
                                .single();

                            const baseWatts = baseline?.pr_2k_watts || 202;
                            setStatus(`Using Baseline: ${baseWatts} Watts`);

                            // 2. Fetch Workouts with RAW DATA
                            // We specifically need raw_data here.
                            const { data: allLogs, error } = await supabase
                                .from('workout_logs')
                                .select('id, raw_data, duration_seconds, workout_name, workout_type, completed_at')
                                .eq('user_id', user.id)
                                .not('raw_data', 'is', null);

                            if (error) throw error;
                            if (!allLogs || allLogs.length === 0) {
                                alert("No workouts with raw data found.");
                                return;
                            }

                            setStatus(`Analyzing ${allLogs.length} workouts...`);

                            let updatedCount = 0;
                            const updates = allLogs.map(log => {
                                let raw = log.raw_data;
                                // Handle stringified JSON if present (legacy artifacts)
                                if (typeof raw === 'string') {
                                    try { raw = JSON.parse(raw); } catch (e) { }
                                }

                                const distribution = calculateZoneDistribution(raw, baseWatts);

                                // If we failed to get distribution (empty), maybe default to "All in UT2" using duration?
                                // Use duration_seconds
                                const sumDist = Object.values(distribution).reduce((a, b) => a + b, 0);
                                if (sumDist === 0 && log.duration_seconds > 0) {
                                    // Fallback: If no intervals/splits, classify the WHOLE workout
                                    // But we lack average watts here unless we fetch it. 
                                    // For now, let's just stick to what calculateZoneDistribution returns.
                                    // Or we can rely on the fact that the Analytics page falls back to duration_minutes if distribution is empty?
                                    // Let's just save what we found.
                                }

                                updatedCount++;
                                return {
                                    id: log.id,
                                    user_id: user.id, // REQUIRED for RLS
                                    workout_name: log.workout_name, // REQUIRED for Not-Null
                                    workout_type: log.workout_type, // REQUIRED for Not-Null
                                    completed_at: log.completed_at, // REQUIRED for Not-Null
                                    zone_distribution: distribution
                                };
                            });

                            // Batch Update ( Supabase upsert by ID )
                            const { error: upsertError } = await supabase
                                .from('workout_logs')
                                .upsert(updates, { onConflict: 'id' });

                            if (upsertError) throw upsertError;

                            const msg = `Deep Analysis Complete! Updated ${updatedCount} workouts with granular zone data.`;
                            setStatus(msg);
                            alert(msg);

                        } catch (err: any) {
                            console.error(err);
                            setError(err.message);
                        }
                    }}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap flex items-center gap-2"
                >
                    <Microscope size={16} />
                    Reprocess History
                </button>
            </div >
        </div >
    );
};
