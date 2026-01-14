import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { splitToWatts, wattsToSplit, formatSplit } from '../../utils/zones';

interface Props {
    onUpdate: () => void; // Trigger parent refresh
}

export const BaselineInput: React.FC<Props> = ({ onUpdate }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [watts, setWatts] = useState<number>(0);
    const [splitInput, setSplitInput] = useState<string>(''); // e.g., "1:45.0"
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBaseline();
    }, []);

    const fetchBaseline = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('user_baseline_metrics')
            .select('pr_2k_watts, pr_2k_time')
            .eq('user_id', user.id)
            .single();

        if (data?.pr_2k_watts) {
            setWatts(data.pr_2k_watts);
            setSplitInput(formatSplit(wattsToSplit(data.pr_2k_watts)));
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
            // Parse "1:45.5" or "105.5" -> Seconds
            const parts = splitInput.split(':');
            let totalSeconds = 0;
            if (parts.length === 2) {
                totalSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            } else {
                totalSeconds = parseFloat(parts[0]); // assume purely seconds if no colon? Rare.
            }

            if (isNaN(totalSeconds) || totalSeconds < 80 || totalSeconds > 300) {
                throw new Error("Invalid split format. Use MM:SS.d (e.g. 1:45.0)");
            }

            const calculatedWatts = Math.round(splitToWatts(totalSeconds));
            setWatts(calculatedWatts);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not logged in");

            const { error } = await supabase
                .from('user_baseline_metrics')
                .upsert({
                    user_id: user.id,
                    pr_2k_watts: calculatedWatts,
                    last_updated: new Date().toISOString()
                });

            if (error) throw error;
            onUpdate();

        } catch (err: any) {
            setError(err.message);
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
