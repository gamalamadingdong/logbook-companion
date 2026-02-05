import React, { useMemo, useState, useEffect } from 'react';
import { workoutService } from '../../services/workoutService';
import { getDistanceBucket, isSteadyState } from '../../utils/workoutNormalization';
import { ZonePaceTrendChart } from './ZonePaceTrendChart';
import { Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SteadyStateAnalysisProps {
    baselineWatts: number;
}

const BUCKETS = [
    'Short (< 5k)',
    'Medium (5k - 10k)',
    'Long (10k - 15k)',
    'Endurance (15k+)'
];

const DATE_RANGES = [
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: '1Y', days: 365 },
    { label: 'All', days: 99999 }
];

export const SteadyStateAnalysis: React.FC<SteadyStateAnalysisProps> = ({ baselineWatts }) => {
    const [workouts, setWorkouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBucket, setSelectedBucket] = useState<string>('Medium (5k - 10k)');
    const [dateRange, setDateRange] = useState<number>(180); // Default 6 months
    const navigate = useNavigate();

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const data = await workoutService.getSteadyStateHistory();
                // Filter for Steady State only (JustRow, FixedDistance, etc, no Benchmarks)
                const steadyOnly = data.filter(w => isSteadyState(w.type, w.is_benchmark));
                setWorkouts(steadyOnly);
            } catch (err) {
                console.error("Failed to fetch steady state history", err);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const filteredWorkouts = useMemo(() => {
        // 1. Filter by Bucket
        const inBucket = workouts.filter(w => getDistanceBucket(w.distance) === selectedBucket);

        // 2. Filter by Date
        if (dateRange === 99999) return inBucket;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - dateRange);
        return inBucket.filter(w => new Date(w.date) >= cutoff);
    }, [workouts, selectedBucket, dateRange]);

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-emerald-500" size={24} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Steady State Analysis</h2>
                    <p className="text-neutral-500 text-sm">Analyze pacing trends for continuous pieces, grouped by distance.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Date Range Selector */}
                    <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex flex-wrap gap-1">
                        {DATE_RANGES.map(range => (
                            <button
                                key={range.label}
                                onClick={() => setDateRange(range.days)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === range.days
                                    ? 'bg-neutral-800 text-white shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-300'
                                    }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>

                    {/* Bucket Selector */}
                    <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex flex-wrap gap-1">
                        {BUCKETS.map(bucket => (
                            <button
                                key={bucket}
                                onClick={() => setSelectedBucket(bucket)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${selectedBucket === bucket
                                    ? 'bg-neutral-800 text-white shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-300'
                                    }`}
                            >
                                {bucket.split(' ')[0]} {/* Show Short/Medium/Long */}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Chart */}
            <ZonePaceTrendChart
                workouts={filteredWorkouts.map(w => ({
                    ...w,
                    distance_meters: w.distance,
                    completed_at: w.date,
                    workout_name: w.name,
                    duration_seconds: w.time,
                    heart_rate: { average: w.hr }
                }))}
                baselineWatts={baselineWatts}
            />

            {/* List of Workouts in Bucket */}
            <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center">
                    <h3 className="font-semibold text-neutral-300 text-sm">Recent {selectedBucket} Workouts</h3>
                    <span className="text-xs text-neutral-500">{filteredWorkouts.length} total</span>
                </div>
                <div className="divide-y divide-neutral-800">
                    {filteredWorkouts.slice(0, 5).map(w => (
                        <div
                            key={w.id}
                            onClick={() => navigate(`/workout/${w.external_id || w.id}`)}
                            className="px-6 py-3 flex items-center justify-between hover:bg-neutral-800/50 cursor-pointer transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="text-neutral-400 text-sm w-24">{new Date(w.date).toLocaleDateString()}</div>
                                <div className="text-white font-medium">{w.name}</div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-emerald-400 font-mono font-medium text-sm">
                                        {w.watts ? `${w.watts}w` : '-'}
                                    </div>
                                    <div className="text-xs text-neutral-500">Power</div>
                                </div>
                                <div className="text-right w-16">
                                    <div className="text-neutral-300 font-mono text-sm">
                                        {w.rate ? `${w.rate} spm` : '-'}
                                    </div>
                                    <div className="text-xs text-neutral-500">Rate</div>
                                </div>
                                <ArrowRight size={14} className="text-neutral-600 group-hover:text-emerald-500 transition-colors" />
                            </div>
                        </div>
                    ))}
                    {filteredWorkouts.length === 0 && (
                        <div className="px-6 py-8 text-center text-neutral-500 text-sm">
                            No workouts found in this range.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
