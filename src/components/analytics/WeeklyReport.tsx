
import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Share2, X, Trophy, Activity, Calendar } from 'lucide-react';
import { ZONES } from '../../utils/zones';

interface WeeklyReportProps {
    workouts: any[];
    startDate: Date;
    endDate: Date;
    onClose: () => void;
    username?: string;
}

export const WeeklyReport: React.FC<WeeklyReportProps> = ({ workouts, startDate, endDate, onClose, username }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [generating, setGenerating] = useState(false);

    // --- Calculations ---
    const totalDistance = workouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0);
    const totalTimeSeconds = workouts.reduce((acc, w) => acc + (w.duration_seconds || (w.duration_minutes * 60) || 0), 0);
    const count = workouts.length;

    // Determine "Top Workout" (Highest Watts or Longest Distance)
    const topWorkout = workouts.reduce((prev, current) => {
        return (prev.watts || 0) > (current.watts || 0) ? prev : current;
    }, workouts[0]);

    // Zone Dist (Simplified)
    const zoneDist = { UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0 };
    workouts.forEach(w => {
        // rudimentary classification if pre-calculated distribution missing
        // using the same logic as Analytics.tsx effectively, or relying on `training_zone`
        if (w.training_zone && ZONES.find(z => z.id === w.training_zone)) {
            // @ts-ignore
            zoneDist[w.training_zone]++;
        }
    });

    const handleDownload = async () => {
        if (!reportRef.current) return;
        setGenerating(true);
        try {
            const canvas = await html2canvas(reportRef.current, {
                backgroundColor: '#0a0a0a', // match Neutral-950
                scale: 2, // Retina
                useCORS: true
            });

            const link = document.createElement('a');
            link.download = `Training-Report-${startDate.toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="flex flex-col gap-4 max-w-md w-full">

                {/* Controls */}
                <div className="flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">Weekly Report</h3>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* The Card to Caption */}
                <div
                    ref={reportRef}
                    className="bg-neutral-950 border border-neutral-800 rounded-2xl p-8 space-y-8 relative overflow-hidden shadow-2xl"
                    style={{ minHeight: '500px' }}
                >
                    {/* Background Gradients */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/2"></div>

                    {/* Header */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                                <Activity size={18} className="text-black" />
                            </div>
                            <span className="font-bold text-emerald-500 tracking-wider text-sm uppercase">Logbook Analyzer</span>
                        </div>
                        <h2 className="text-3xl font-extrabold text-white mt-4">Training Summary</h2>
                        <p className="text-neutral-400 font-medium flex items-center gap-2 mt-2">
                            <Calendar size={14} />
                            {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                    </div>

                    {/* Key Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800/50">
                            <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Total Distance</div>
                            <div className="text-2xl font-bold text-white">{(totalDistance / 1000).toFixed(1)} <span className="text-sm font-normal text-neutral-600">km</span></div>
                        </div>
                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800/50">
                            <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Total Time</div>
                            <div className="text-2xl font-bold text-white">{(totalTimeSeconds / 3600).toFixed(1)} <span className="text-sm font-normal text-neutral-600">hrs</span></div>
                        </div>
                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800/50 col-span-2 flex items-center justify-between">
                            <div>
                                <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Sessions</div>
                                <div className="text-2xl font-bold text-white">{count}</div>
                            </div>
                            <div className="h-10 w-px bg-neutral-800 mx-4"></div>
                            <div>
                                <div className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Avg Watts</div>
                                {/* Simple avg of avgs for now, or total work needed */}
                                <div className="text-2xl font-bold text-white">
                                    {Math.round(workouts.reduce((a, b) => a + (b.watts || 0), 0) / (count || 1))}
                                    <span className="text-xs font-normal text-neutral-600 ml-1">w</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Workout Highlight */}
                    {topWorkout && (
                        <div className="relative z-10 bg-gradient-to-br from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3 text-amber-400">
                                <Trophy size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Workout of the Week</span>
                            </div>
                            <div className="text-white font-medium text-lg leading-tight mb-1">
                                {topWorkout.workout_name || 'Untitled Workout'}
                            </div>
                            <div className="text-neutral-500 text-sm">
                                {new Date(topWorkout.completed_at).toLocaleDateString(undefined, { weekday: 'long' })} • {(topWorkout.distance_meters / 1000).toFixed(1)}k
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pt-4 border-t border-neutral-800/50 flex justify-between items-end relative z-10">
                        <div className="text-[10px] text-neutral-600">
                            Generated by Logbook Analyzer
                        </div>
                        <div className="flex gap-1">
                            {/* Visual Noise for 'Zones' */}
                            <div className="w-1 h-3 bg-neutral-800 rounded-full"></div>
                            <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                            <div className="w-1 h-4 bg-emerald-600 rounded-full"></div>
                            <div className="w-1 h-2 bg-neutral-800 rounded-full"></div>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleDownload}
                    disabled={generating}
                    className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                >
                    {generating ? (
                        <>Generating...</>
                    ) : (
                        <>
                            <Download size={18} />
                            Download Image
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
