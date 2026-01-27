
import React, { useEffect, useState } from 'react';
import { Trophy, Calendar, Timer, Zap, Gauge } from 'lucide-react';
import { fetchUserPRs, formatTime, formatPace, formatWatts, calculateWatts } from '../../utils/prDetection';
import type { PRRecord } from '../../utils/prDetection';

import { useAuth } from '../../hooks/useAuth';

interface PRListProps {
    userId: string;
}

type Unit = 'pace' | 'time' | 'watts';

export const PRList: React.FC<PRListProps> = ({ userId }) => {
    const { profile } = useAuth();
    const [prs, setPrs] = useState<PRRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [unit, setUnit] = useState<Unit>('pace');

    useEffect(() => {
        const load = async () => {
            if (!userId) return;
            setLoading(true);
            const data = await fetchUserPRs(userId);
            setPrs(data);
            setLoading(false);
        };
        load();
    }, [userId]);

    if (loading) return (
        <div className="bg-neutral-900/30 border border-neutral-800 rounded-2xl p-6 min-h-[200px] flex items-center justify-center animate-pulse">
            <div className="h-4 w-32 bg-neutral-800 rounded"></div>
        </div>
    );

    if (prs.length === 0) return null;

    // Filter and Augment PRs based on preferences
    const visiblePrs = prs.filter(pr => {
        const pref = profile?.benchmark_preferences?.[pr.label];
        // Default to true if not specified
        return pref?.is_tracked !== false;
    });

    // Group PRs
    const distances = visiblePrs.filter(p => !p.isInterval);
    const intervals = visiblePrs.filter(p => p.isInterval);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Trophy size={20} className="text-amber-400" />
                    Personal Records
                </h3>

                {/* Unit Toggle */}
                <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1">
                    <button
                        onClick={() => setUnit('pace')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${unit === 'pace' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        <Gauge size={12} />
                        Split
                    </button>
                    <button
                        onClick={() => setUnit('time')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${unit === 'time' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        <Timer size={12} />
                        Time
                    </button>
                    <button
                        onClick={() => setUnit('watts')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${unit === 'watts' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                        <Zap size={12} />
                        Watts
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Standard Distances */}
                {distances.map(pr => (
                    <PRCard
                        key={pr.label}
                        pr={pr}
                        unit={unit}
                        workingBaseline={profile?.benchmark_preferences?.[pr.label]?.working_baseline}
                    />
                ))}

                {/* Separator if both exist */}
                {distances.length > 0 && intervals.length > 0 && (
                    <div className="col-span-full border-t border-neutral-800 my-2 pt-2">
                        <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Interval Benchmarks</h4>
                    </div>
                )}

                {/* Interval Patterns */}
                {intervals.map(pr => (
                    <PRCard
                        key={pr.label}
                        pr={pr}
                        unit={unit}
                        workingBaseline={profile?.benchmark_preferences?.[pr.label]?.working_baseline}
                    />
                ))}
            </div>
        </div>
    );
};

import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

const PRCard: React.FC<{ pr: PRRecord, unit: Unit, workingBaseline?: string }> = ({ pr, unit, workingBaseline }) => {
    const isSplit = pr.source === 'interval_split';

    // Calculate display value for the ACTUAL PR
    let mainValue = '';
    let subValue = '';

    if (unit === 'pace') {
        const pace = pr.isInterval ? pr.pace : (pr.pace || (pr.time / pr.distance) * 500);
        mainValue = formatPace(pace);
        subValue = '/500m';
    } else if (unit === 'time') {
        mainValue = formatTime(pr.time);
        subValue = '';
    } else if (unit === 'watts') {
        const pace = pr.isInterval ? pr.pace : (pr.time / pr.distance) * 500;
        const watts = calculateWatts(pace);
        mainValue = formatWatts(watts);
        subValue = '';
    }

    const showBaseline = !!workingBaseline;
    const displayValue = showBaseline ? workingBaseline : mainValue;
    const secondaryValue = showBaseline ? mainValue : null; // Validation/Comparison

    // Calculate History Link Name
    // Intervals: Use label (e.g. "4x500m")
    // Distances: Use "2000m" format
    const historyName = pr.isInterval ? pr.label : `${pr.distance}m`;

    return (
        <div className={`relative group flex flex-col bg-neutral-900/50 border ${showBaseline ? 'border-emerald-500/30' : 'border-neutral-800'} hover:border-neutral-700 hover:bg-neutral-900 transition-all rounded-xl p-4 gap-3 overflow-hidden`}>

            {/* Main Link Area (Goes to History) */}
            <Link to={`/history/${encodeURIComponent(historyName)}`} className="absolute inset-0 z-10" />

            {/* Background Glow for Splits */}
            {isSplit && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 blur-xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
            )}

            {/* Working Baseline Indicator */}
            {showBaseline && (
                <div className="absolute top-0 right-0 px-2 py-1 bg-emerald-500/20 rounded-bl-lg z-0">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Target</span>
                </div>
            )}

            <div className="flex justify-between items-start relative z-20 pointer-events-none">
                <div>
                    <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                        {pr.label}
                        {isSplit && <span className="bg-blue-500/20 text-blue-400 text-[9px] px-1.5 py-0.5 rounded-full ml-1">Split</span>}
                    </div>
                </div>
                {!showBaseline && <div className="flex gap-2">
                    {/* Activity Icon - Visual only */}
                    <Trophy size={14} className={`${isSplit ? 'text-blue-500/50' : 'text-amber-500/50'} group-hover:scale-110 transition-transform`} />
                </div>}
            </div>

            <div className="flex items-baseline gap-2 relative z-20 pointer-events-none">
                <span className={`text-2xl font-bold font-mono ${showBaseline ? 'text-emerald-400' : 'text-white'}`}>
                    {displayValue}
                </span>
                <span className="text-xs text-neutral-500">
                    {subValue}
                </span>
            </div>

            <div className="border-t border-neutral-800 pt-3 flex flex-col gap-1 text-xs text-neutral-500 relative z-20">
                <div className="flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        {new Date(pr.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                    </div>
                    {/* If showing baseline, show the actual PR here */}
                    {showBaseline && (
                        <div className="flex items-center gap-1.5 text-neutral-400" title="All-Time Best">
                            <Trophy size={10} className="text-amber-500/70" />
                            <span className="font-mono">{secondaryValue}</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-end mt-1">
                    {/* Secondary Metric Display */}
                    {!showBaseline && unit !== 'pace' && (
                        <div className="font-mono text-neutral-600 pointer-events-none break-keep">
                            {formatPace(pr.isInterval ? pr.pace : (pr.time / pr.distance) * 500)}/500m
                        </div>
                    )}
                    {!showBaseline && unit === 'pace' && (
                        <div className="font-mono text-neutral-600 pointer-events-none">
                            {formatWatts(calculateWatts(pr.isInterval ? pr.pace : (pr.time / pr.distance) * 500))}
                        </div>
                    )}

                    {/* Specific Workout Link (Clickable above the main link) */}
                    <Link
                        to={`/workout/${pr.workoutId}`}
                        className="pointer-events-auto relative z-30 text-neutral-600 hover:text-white transition-colors flex items-center gap-1"
                        title="View specific workout file"
                    >
                        <span className="text-[10px]">View File</span>
                        <ExternalLink size={10} />
                    </Link>
                </div>
            </div>
        </div>
    );
};
