import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, type UserProfile } from '../services/supabase';
import { PR_DISTANCES, BENCHMARK_PATTERNS } from '../utils/prCalculator';
import { calculateCanonicalName } from '../utils/workoutNaming';
import { fetchUserPRs } from '../utils/prDetection';
import { Loader2, Database } from 'lucide-react';
import { GoalsManager } from '../components/GoalsManager';
import { PowerBackfill } from '../components/debug/PowerBackfill';
import { useTheme, type ThemePreference } from '../hooks/useTheme';

export const Preferences: React.FC = () => {
    const { profile, loading: authLoading, refreshProfile } = useAuth();
    const { themePreference, setThemePreference } = useTheme();
    const [activeTab, setActiveTab] = useState<'general' | 'profile' | 'benchmarks' | 'goals'>('profile');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<UserProfile>>({});

    // Dynamic Benchmarks
    const [extraBenchmarks, setExtraBenchmarks] = useState<{ key: string, label: string, type: 'Distance' | 'Interval' }[]>([]);
    const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);

    const isThemePreference = (value: unknown): value is ThemePreference => (
        value === 'dark' || value === 'light' || value === 'system'
    );

    useEffect(() => {
        if (profile) {
            setFormData({
                max_heart_rate: profile.max_heart_rate,
                resting_heart_rate: profile.resting_heart_rate,
                weight_lbs: profile.weight_lbs,
                birth_date: profile.birth_date,
                display_name: profile.display_name,
                benchmark_preferences: profile.benchmark_preferences || {},
                preferences: profile.preferences || {}
            });
        }
    }, [profile]);

    // Fetch unique user benchmarks when tab is activated
    useEffect(() => {
        const loadBenchmarks = async () => {
            if (activeTab === 'benchmarks' && profile?.user_id) {
                setLoadingBenchmarks(true);
                const prs = await fetchUserPRs(profile.user_id);

                const uniqueLabels = new Set(prs.map(p => p.label));
                const standardLabels = new Set([
                    ...PR_DISTANCES.map(d => d.label),
                    ...BENCHMARK_PATTERNS
                ]);

                const extras: typeof extraBenchmarks = [];
                uniqueLabels.forEach(label => {
                    if (!standardLabels.has(label)) {
                        // Guess type based on label content
                        // const isDist = label.endsWith('k') || label.endsWith('m') && !label.includes('x'); 
                        // Unused var removed
                        const sample = prs.find(p => p.label === label);
                        extras.push({
                            key: label,
                            label: label,
                            type: sample?.isInterval ? 'Interval' : 'Distance'
                        });
                    }
                });
                setExtraBenchmarks(extras);
                setLoadingBenchmarks(false);
            }
        };

        loadBenchmarks();
    }, [activeTab, profile?.user_id]);

    const handleSave = async () => {
        if (!profile?.user_id) return;
        setSaving(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update(formData)
                .eq('user_id', profile.user_id);

            if (error) throw error;

            await refreshProfile();
            setMessage({ type: 'success', text: 'Preferences saved successfully.' });
        } catch (err: unknown) {
            console.error('[Preferences] Save failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to save.';
            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setSaving(false);
        }
    };

    const toggleBenchmark = (key: string) => {
        const currentPrefs = formData.benchmark_preferences || {};
        const currentSetting = currentPrefs[key] || { is_tracked: true }; // Default to tracked if undefined

        setFormData(prev => ({
            ...prev,
            benchmark_preferences: {
                ...prev.benchmark_preferences,
                [key]: {
                    ...currentSetting,
                    is_tracked: !currentSetting.is_tracked
                }
            }
        }));
    };

    const updateBaseline = (key: string, value: string) => {
        const currentPrefs = formData.benchmark_preferences || {};
        const currentSetting = currentPrefs[key] || { is_tracked: true };

        setFormData(prev => ({
            ...prev,
            benchmark_preferences: {
                ...prev.benchmark_preferences,
                [key]: {
                    ...currentSetting,
                    working_baseline: value
                }
            }
        }));
    };

    const toggleGeneralPreference = async (key: string) => {
        if (!profile?.user_id) return;

        const currentPrefs = formData.preferences || {};
        const currentVal = currentPrefs[key];
        // Default to true if undefined (for show_recommended_workouts)
        // actually show_recommended_workouts defaults to true usually? 
        // Logic in input checked is: checked={formData.preferences?.show_recommended_workouts !== false}
        // So default is TRUE.
        // If currentVal is undefined, it is implicitly true. So nextVal should be false.
        // If currentVal is true, nextVal false.
        // If currentVal is false, nextVal true.
        const nextVal = currentVal === undefined ? false : !currentVal;


        // Optimistic Update
        const updatedPrefs = {
            ...currentPrefs,
            [key]: nextVal
        };

        setFormData(prev => ({
            ...prev,
            preferences: updatedPrefs
        }));

        // Auto-save to DB
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ preferences: updatedPrefs })
                .eq('user_id', profile.user_id);

            if (error) throw error;

            await refreshProfile();
            // Optional: show a transient success message if needed, 
            // but for toggle usually visual state is enough.
        } catch (err) {
            console.error('[Preferences] Auto-save failed:', err);
            setMessage({ type: 'error', text: 'Failed to save preference.' });
            // Revert state?
            setFormData(prev => ({
                ...prev,
                preferences: {
                    ...prev.preferences,
                    [key]: currentVal // Revert to old value
                }
            }));
        }
    };

    const updateThemePreference = async (nextTheme: ThemePreference) => {
        if (!profile?.user_id) return;
        const currentPrefs = formData.preferences || {};
        const previousTheme = isThemePreference(currentPrefs.theme) ? currentPrefs.theme : themePreference;
        const updatedPrefs = {
            ...currentPrefs,
            theme: nextTheme
        };

        setFormData(prev => ({
            ...prev,
            preferences: updatedPrefs
        }));
        setThemePreference(nextTheme);

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ preferences: updatedPrefs })
                .eq('user_id', profile.user_id);

            if (error) throw error;

            await refreshProfile();
        } catch (err) {
            console.error('[Preferences] Theme update failed:', err);
            setMessage({ type: 'error', text: 'Failed to save theme preference.' });
            setFormData(prev => ({
                ...prev,
                preferences: {
                    ...prev.preferences,
                    theme: previousTheme
                }
            }));
            setThemePreference(previousTheme);
        }
    };

    if (authLoading) return <div className="p-8 text-neutral-400">Loading profile...</div>;

    const allBenchmarks = [
        ...PR_DISTANCES.map(d => ({ key: d.label, label: d.label, type: 'Distance' })),
        ...BENCHMARK_PATTERNS.map(p => ({ key: p, label: p, type: 'Interval' })),
        // Combine with dynamically found ones:
        ...extraBenchmarks
    ];

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-neutral-100">Preferences</h1>
                <p className="text-neutral-400 mt-2">Manage your athlete profile and tracking settings.</p>
            </header>

            {/* Tabs */}
            <div className="flex space-x-6 border-b border-neutral-800">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`pb-3 px-1 ${activeTab === 'general' ? 'text-emerald-500 border-b-2 border-emerald-500 font-medium' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`pb-3 px-1 ${activeTab === 'profile' ? 'text-emerald-500 border-b-2 border-emerald-500 font-medium' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                    Athlete Profile
                </button>
                <button
                    onClick={() => setActiveTab('goals')}
                    className={`pb-3 px-1 ${activeTab === 'goals' ? 'text-emerald-500 border-b-2 border-emerald-500 font-medium' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                    Training Goals
                </button>
                <button
                    onClick={() => setActiveTab('benchmarks')}
                    className={`pb-3 px-1 ${activeTab === 'benchmarks' ? 'text-emerald-500 border-b-2 border-emerald-500 font-medium' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                    Benchmarks
                </button>
            </div>


            {/* Content */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                {activeTab === 'general' && (
                    <div className="space-y-6 max-w-lg">
                        <div>
                            <h3 className="text-lg font-medium text-neutral-200 mb-4">Dashboard Features</h3>
                            <div className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-neutral-200">Recommended Workouts</h4>
                                    <p className="text-sm text-neutral-500 mt-1">
                                        Show daily workout suggestions on the Dashboard.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        aria-label="Toggle recommended workouts"
                                        checked={formData.preferences?.show_recommended_workouts !== false}
                                        onChange={() => toggleGeneralPreference('show_recommended_workouts')}
                                    />
                                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-neutral-200 mb-4">Appearance</h3>
                            <div className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-neutral-200">Theme</h4>
                                    <p className="text-sm text-neutral-500 mt-1">
                                        Choose between light, dark, or system mode.
                                    </p>
                                </div>
                                <label className="text-sm text-neutral-400">
                                    <span className="sr-only">Theme preference</span>
                                    <select
                                        className="bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                                        value={themePreference}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            if (isThemePreference(value)) {
                                                updateThemePreference(value);
                                            }
                                        }}
                                    >
                                        <option value="dark">Dark</option>
                                        <option value="light">Light</option>
                                        <option value="system">System</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'goals' && profile?.user_id && (
                    <GoalsManager userId={profile.user_id} />
                )}

                {activeTab === 'profile' && (
                    <div className="space-y-6 max-w-lg">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1">Display Name</label>
                            <input
                                type="text"
                                aria-label="Display Name"
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
                                value={formData.display_name || ''}
                                onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">Max Heart Rate (bpm)</label>
                                <input
                                    type="number"
                                    aria-label="Max Heart Rate"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
                                    value={formData.max_heart_rate || ''}
                                    onChange={e => setFormData({ ...formData, max_heart_rate: parseInt(e.target.value) || undefined })}
                                />
                                <p className="text-xs text-neutral-500 mt-1">Used for Zone calculations.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">Resting HR (bpm)</label>
                                <input
                                    type="number"
                                    aria-label="Resting Heart Rate"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
                                    value={formData.resting_heart_rate || ''}
                                    onChange={e => setFormData({ ...formData, resting_heart_rate: parseInt(e.target.value) || undefined })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-1">Weight (lbs)</label>
                                <input
                                    type="number"
                                    aria-label="Weight in pounds"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
                                    value={formData.weight_lbs || ''}
                                    onChange={e => setFormData({ ...formData, weight_lbs: parseInt(e.target.value) || undefined })}
                                />
                            </div>

                        </div>

                        {/* Concept2 Sync Settings - Note: Auto-sync controlled via localStorage */}
                        <div className="mt-6 pt-6 border-t border-neutral-800">
                            <h3 className="font-medium text-neutral-200 mb-3">Concept2 Sync</h3>
                            <p className="text-sm text-neutral-400">Sync is currently controlled via the Sync page. Visit the Sync page to manage your Concept2 connection.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'benchmarks' && (
                    <div className="space-y-6">
                        <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg text-blue-200 text-sm mb-6">
                            Uncheck benchmarks you don't want to see in your Analytics. Set a "Working Baseline" (e.g., 7:00 or 1:45.0) to track progress against a goal or current capacity instead of your all-time best.
                        </div>

                        {loadingBenchmarks && (
                            <div className="text-sm text-neutral-500 italic mb-4">Scanning workout history for benchmarks...</div>
                        )}

                        <div className="overflow-hidden border border-neutral-800 rounded-lg">
                            <table className="w-full text-left bg-neutral-950/50">
                                <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-16 text-center">Track</th>
                                        <th className="px-4 py-3">Benchmark</th>
                                        <th className="px-4 py-3">Working Baseline</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {allBenchmarks.map((b) => {
                                        const pref = formData.benchmark_preferences?.[b.key] || { is_tracked: true }; // Default true
                                        /* Default true if not present, but if present use value.
                                           Actually, if key is missing, it implies 'true' by default logic usually?
                                           Let's explicitely set defaults effectively.
                                        */
                                        const isTracked = pref.is_tracked !== false;

                                        return (
                                            <tr key={b.key} className="hover:bg-neutral-900/50 transition-colors">
                                                <td className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Track ${b.label} benchmark`}
                                                        checked={isTracked}
                                                        onChange={() => toggleBenchmark(b.key)}
                                                        className="w-4 h-4 rounded border-gray-600 bg-neutral-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-neutral-900"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`font-medium ${isTracked ? 'text-neutral-200' : 'text-neutral-500'}`}>{b.label}</span>
                                                    <span className="ml-2 text-xs text-neutral-600 border border-neutral-800 px-1 rounded">{b.type}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. 7:00"
                                                        disabled={!isTracked}
                                                        value={pref.working_baseline || ''}
                                                        onChange={(e) => updateBaseline(b.key, e.target.value)}
                                                        className="bg-transparent border-b border-neutral-800 focus:border-emerald-500 focus:outline-none text-neutral-300 w-32 px-1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Database Tools Section - Always visible or potentially its own tab? kept at bottom for now */}
                <div className="mt-8 pt-8 border-t border-neutral-800">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-neutral-800 rounded-xl text-neutral-400">
                            <Database size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-200">Database Tools</h2>
                            <p className="text-neutral-500 text-sm">Maintenance tasks for your workout history.</p>
                        </div>
                    </div>

                    <div className="bg-neutral-900/30 rounded-lg p-6 border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="text-neutral-300 font-medium">Optimize Workout Names</h3>
                            <p className="text-neutral-500 text-sm mt-1">
                                Scans all workouts and generates standardized names (e.g. "5x1500m") for better history grouping.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if (!window.confirm("This will scan all workouts and update their names. Continue?")) return;
                                setSaving(true);
                                setMessage(null);
                                try {
                                    const { data: { user } } = await supabase.auth.getUser();
                                    if (!user) throw new Error("Not logged in");

                                    // 1. Fetch ALL logs
                                    const { data: allLogs, error } = await supabase
                                        .from('workout_logs')
                                        .select('id, raw_data, workout_name, canonical_name, workout_type, distance_meters, duration_minutes, calories_burned, watts')
                                        .eq('user_id', user.id);

                                    if (error) throw error;

                                    let updated = 0;
                                    const updates = [];

                                    for (const log of allLogs || []) {
                                        let newName = log.canonical_name;

                                        // Ensure raw_data is object
                                        let raw = log.raw_data;
                                        if (typeof raw === 'string') {
                                            try { raw = JSON.parse(raw); } catch { /* Ignore parse errors */ }
                                        }

                                        // 1. Try to calculate from intervals
                                        if (!newName && raw?.workout?.intervals) {
                                            newName = calculateCanonicalName(raw.workout.intervals);
                                        }

                                        // 2. Fallbacks if calc returned "Unknown" or no intervals found
                                        // Use workout_name because workout_type is usually 'rower'
                                        if (!newName || newName === 'Unknown') {
                                            const type = log.workout_name || '';

                                            if (['FixedDistanceSplits', 'FixedDistanceNoSplits', 'FixedDistanceInterval'].includes(type) || type === 'DistanceInterval') {
                                                newName = `${Math.round(log.distance_meters)}m`;
                                            } else if (['FixedTimeSplits', 'FixedTimeNoSplits', 'FixedTimeInterval'].includes(type) || type === 'TimeInterval') {
                                                const mins = Math.round(log.duration_minutes);
                                                newName = `${mins}:00`;
                                            } else if (['FixedCalorie', 'FixedCalorieSplits', 'FixedCalorieNoSplits', 'FixedCalorieInterval'].includes(type) || type === 'CalorieInterval') {
                                                newName = `${log.calories_burned} cal`;
                                            } else if (['FixedWattMinute', 'FixedWattMinuteInterval', 'FixedWattSplits', 'FixedWattNoSplits'].includes(type) || type === 'WattInterval' || type === 'WattsInterval') {
                                                newName = `${Math.round(log.watts || 0)}W`;
                                            } else if (type === 'JustRow' || type.includes('Just Row')) {
                                                newName = `${Math.floor(log.distance_meters)}m JustRow`;
                                            }
                                        }

                                        if (newName && newName !== log.canonical_name) {
                                            updates.push({
                                                id: log.id,
                                                user_id: user.id, // Required for RLS usually
                                                canonical_name: newName,
                                                // Minimal update payload - but supabase upsert might need other required fields if not partial?
                                                // Actually 'update' is better for partial, but we want batch.
                                                // upsert requires primary key.
                                            });
                                            updated++;
                                        }
                                    }

                                    if (updates.length > 0) {
                                        // Process in chunks of 50 to be safe
                                        const chunkSize = 50;
                                        for (let i = 0; i < updates.length; i += chunkSize) {
                                            const chunk = updates.slice(i, i + chunkSize);
                                            // We have to use upsert for batch, but we need to be careful not to wipe other fields if they are required.
                                            // Ideally we use `update`. But `update` doesn't batch efficiently like upsert.
                                            // Let's loop update for safety or use upsert with all required fields?
                                            // Actually, let's just do parallel updates. It's client side, it's fine.

                                            await Promise.all(chunk.map(u =>
                                                supabase.from('workout_logs').update({ canonical_name: u.canonical_name }).eq('id', u.id)
                                            ));
                                        }
                                    }

                                    setMessage({ type: 'success', text: `Optimization complete. Updated ${updated} workouts.` });
                                } catch (err: unknown) {
                                    console.error(err);
                                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                                    setMessage({ type: 'error', text: 'Optimization failed: ' + errorMessage });
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            disabled={saving}
                            className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
                            {saving ? 'Processing...' : 'Run Optimization'}
                        </button>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t border-neutral-800">
                    <div className="bg-neutral-900/30 rounded-lg p-6 border border-neutral-800">
                        <PowerBackfill />
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-8 pt-8 border-t border-neutral-800">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-rose-900/20 rounded-xl text-rose-500">
                        <Database size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-rose-400">Danger Zone</h2>
                        <p className="text-neutral-500 text-sm">Irreversible actions for your account data.</p>
                    </div>
                </div>

                <div className="bg-rose-950/10 rounded-lg border border-rose-900/20 divide-y divide-rose-900/20">
                    <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="text-neutral-300 font-medium">Delete All Workouts</h3>
                            <p className="text-neutral-500 text-sm mt-1">
                                Permanently removes all your synced workout logs from the database.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if (!window.confirm("Are you sure you want to DELETE ALL WORKOUTS? This cannot be undone.")) return;
                                if (!window.confirm("Please confirm again. All history will be lost.")) return;

                                setSaving(true);
                                setMessage(null);
                                try {
                                    if (!profile?.user_id) throw new Error("Not logged in");
                                    const { error } = await supabase
                                        .from('workout_logs')
                                        .delete()
                                        .eq('user_id', profile.user_id);

                                    if (error) throw error;
                                    setMessage({ type: 'success', text: 'All workouts deleted.' });
                                } catch (err: unknown) {
                                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                                    setMessage({ type: 'error', text: 'Deletion failed: ' + errorMessage });
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            disabled={saving}
                            className="bg-rose-950 hover:bg-rose-900 text-rose-500 hover:text-rose-400 border border-rose-900/50 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                        >
                            Delete Workouts
                        </button>
                    </div>

                    <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="text-neutral-300 font-medium">Remove Integrations & Tokens</h3>
                            <p className="text-neutral-500 text-sm mt-1">
                                Removes your Concept2 connection and clears all stored tokens.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if (!window.confirm("Disconnect Concept2 and clear all tokens?")) return;

                                setSaving(true);
                                setMessage(null);
                                try {
                                    if (!profile?.user_id) throw new Error("Not logged in");
                                    const { error } = await supabase
                                        .from('user_integrations')
                                        .delete()
                                        .eq('user_id', profile.user_id);

                                    if (error) throw error;

                                    // Clear local storage too
                                    localStorage.removeItem('concept2_token');
                                    localStorage.removeItem('concept2_refresh_token');
                                    localStorage.removeItem('concept2_expires_at');

                                    setMessage({ type: 'success', text: 'Integrations removed.' });
                                } catch (err: unknown) {
                                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                                    setMessage({ type: 'error', text: 'Removal failed: ' + errorMessage });
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            disabled={saving}
                            className="bg-rose-950 hover:bg-rose-900 text-rose-500 hover:text-rose-400 border border-rose-900/50 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                        >
                            Remove Integrations
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t border-neutral-800">
                {message && (
                    <span className={`text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {message.text}
                    </span>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : 'Save Preferences'}
                </button>
            </div>
        </div>
    );

};
