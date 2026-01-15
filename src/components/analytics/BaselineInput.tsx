import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { splitToWatts, wattsToSplit, formatSplit } from '../../utils/zones';
import { useAuth } from '../../hooks/useAuth';

interface Props {
    onUpdate: () => void; // Trigger parent refresh
}

export const BaselineInput: React.FC<Props> = ({ onUpdate }) => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [watts, setWatts] = useState<number>(0);
    const [splitInput, setSplitInput] = useState<string>(''); // e.g., "1:45.0"
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBaseline();
    }, [profile]);

    const fetchBaseline = async () => {
        if (!profile?.user_id) return;

        // Fetch from benchmark_preferences (same source as Analytics)
        const { data } = await supabase
            .from('user_profiles')
            .select('benchmark_preferences')
            .eq('user_id', profile.user_id)
            .single();

        const workingBaseline = data?.benchmark_preferences?.['2k']?.working_baseline;

        if (workingBaseline) {
            // Parse "7:00.0" (2k time) -> 500m split
            const parts = workingBaseline.split(':');
            let totalSeconds = 0;
            if (parts.length === 2) {
                totalSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            } else {
                totalSeconds = parseFloat(workingBaseline);
            }

            if (totalSeconds > 0) {
                // Convert 2k time to 500m split
                const split500m = (totalSeconds / 2000) * 500;
                const calculatedWatts = Math.round(splitToWatts(split500m));
                setWatts(calculatedWatts);
                setSplitInput(formatSplit(split500m));
            }
        } else {
            // Default text if nothing set
            setSplitInput("2:00.0");
            setWatts(202); // ~2:00
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);

        try {
            // Parse "1:45.5" or "105.5" -> Seconds (500m split)
            const parts = splitInput.split(':');
            let split500mSeconds = 0;
            if (parts.length === 2) {
                split500mSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            } else {
                split500mSeconds = parseFloat(parts[0]); // assume purely seconds if no colon
            }

            if (isNaN(split500mSeconds) || split500mSeconds < 80 || split500mSeconds > 300) {
                throw new Error("Invalid split format. Use MM:SS.d (e.g. 1:45.0)");
            }

            const calculatedWatts = Math.round(splitToWatts(split500mSeconds));
            setWatts(calculatedWatts);

            if (!profile?.user_id) throw new Error("Not logged in");

            // Convert 500m split to 2k time for storage
            const time2k = (split500mSeconds / 500) * 2000;
            const minutes = Math.floor(time2k / 60);
            const seconds = (time2k % 60).toFixed(1);
            const time2kFormatted = `${minutes}:${seconds.padStart(4, '0')}`;

            // Update benchmark_preferences (same field as Preferences page)
            const { data: currentProfile } = await supabase
                .from('user_profiles')
                .select('benchmark_preferences')
                .eq('user_id', profile.user_id)
                .single();

            const updatedPreferences = {
                ...(currentProfile?.benchmark_preferences || {}),
                '2k': {
                    ...(currentProfile?.benchmark_preferences?.['2k'] || {}),
                    working_baseline: time2kFormatted
                }
            };

            const { error } = await supabase
                .from('user_profiles')
                .update({ benchmark_preferences: updatedPreferences })
                .eq('user_id', profile.user_id);

            if (error) throw error;
            onUpdate();

        } catch (err: any) {
            setError(err.message || 'Failed to save baseline');
            console.error('Failed to save baseline:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-neutral-500 text-sm">Loading baseline...</div>;

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                        <Settings size={20} />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">Training Baseline (2k PR)</h3>
                        <p className="text-neutral-500 text-xs">Used to calculate your Training Zones.</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-white max-w-[100px]">
                        {watts} <span className="text-sm font-normal text-neutral-500">W</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative group flex-1">
                    <input
                        type="text"
                        value={splitInput}
                        onChange={(e) => setSplitInput(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                        placeholder="e.g. 1:45.0"
                    />
                    <div className="absolute right-3 top-2 text-xs text-neutral-600">/500m</div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                    {saving ? 'Saving...' : <><Save size={14} /> Update</>}
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle size={12} />
                    {error}
                </div>
            )}
        </div>
    );
};
