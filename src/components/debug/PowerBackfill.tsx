
import React, { useState } from 'react';
import { supabase } from '../../services/supabase';
import { calculatePowerBuckets } from '../../utils/powerBucketing';

export const PowerBackfill: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(prev => [...prev.slice(-4), msg]);

    const runBackfill = async () => {
        setStatus('running');
        setLog([]);
        try {
            // 1. Fetch all workouts that have raw_data
            addLog("Fetching workouts...");
            const { data: workouts, error } = await supabase
                .from('workout_logs')
                .select('id, raw_data, workout_name')
                .not('raw_data', 'is', null);

            if (error) throw error;
            if (!workouts) {
                addLog("No workouts found.");
                setStatus('completed');
                return;
            }

            setTotal(workouts.length);
            addLog(`Found ${workouts.length} workouts. Starting processing...`);

            let processed = 0;
            for (const workout of workouts) {
                // Parse raw_data
                let raw: any = workout.raw_data;
                if (typeof raw === 'string') {
                    try {
                        raw = JSON.parse(raw);
                    } catch (e) {
                        addLog(`Failed to parse JSON for ${workout.id}`);
                        continue;
                    }
                }

                // Calculate Buckets
                try {
                    const buckets = calculatePowerBuckets(raw);

                    // Upsert to DB
                    const { error: insertError } = await supabase
                        .from('workout_power_distribution')
                        .upsert({
                            workout_id: workout.id,
                            buckets: buckets
                        });

                    if (insertError) {
                        addLog(`Error saving ${workout.id}: ${insertError.message}`);
                    }
                } catch (e) {
                    addLog(`Error calculating ${workout.id}: ${e}`);
                }

                processed++;
                setProgress(processed);
                if (processed % 10 === 0) {
                    // small delay to let UI breathe
                    await new Promise(r => setTimeout(r, 10));
                }
            }

            setStatus('completed');
            addLog("Backfill complete!");

        } catch (err: any) {
            console.error(err);
            setStatus('error');
            addLog(`Critical Error: ${err.message}`);
        }
    };

    return (
        <div className="p-4 border rounded-lg bg-gray-50 border-gray-200 my-4">
            <h3 className="font-bold text-lg mb-2">Power Data Backfill</h3>
            <p className="text-sm text-gray-600 mb-4">
                Process existing workouts and generate 5-Watt Buckets for history.
            </p>

            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={runBackfill}
                    disabled={status === 'running'}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {status === 'running' ? 'Processing...' : 'Start Backfill'}
                </button>
                {status === 'running' && (
                    <span className="text-sm font-mono">{progress} / {total}</span>
                )}
            </div>

            {status === 'running' && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                    <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${(progress / total) * 100}%` }}
                    ></div>
                </div>
            )}

            <div className="bg-black text-white p-2 rounded text-xs font-mono h-32 overflow-y-auto">
                {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>
    );
};
