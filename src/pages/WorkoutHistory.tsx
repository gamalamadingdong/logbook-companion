import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { workoutService } from '../services/workoutService';

export const WorkoutHistory: React.FC = () => {
    const { name } = useParams<{ name: string }>();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const workoutName = decodeURIComponent(name || '');

    useEffect(() => {
        if (!workoutName) return;

        const loadData = async () => {
            try {
                const data = await workoutService.getWorkoutHistory(workoutName);
                setHistory(data);
            } catch (err) {
                console.error("Failed to load history", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [workoutName]);

    if (loading) return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-emerald-500">
            Loading...
        </div>
    );

    if (history.length === 0) return (
        <div className="min-h-screen bg-neutral-950 p-12 text-center text-neutral-400">
            No history found for "{workoutName}"
        </div>
    );

    // Format Data for Chart (oldest to newest for left-to-right progression)
    const chartData = [...history].reverse().map(h => ({
        date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
        watts: h.watts,
        dateObj: new Date(h.date) // For sorting if needed
    }));

    return (
        <div className="min-h-screen bg-neutral-950 p-6 md:p-12 font-sans text-white pb-24">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-4">
                    <Link to="/analytics" className="inline-flex items-center text-neutral-400 hover:text-white transition-colors group">
                        <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Back to Analytics</span>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">
                            History: <span className="text-emerald-500">{workoutName}</span>
                        </h1>
                        <p className="text-neutral-500 mt-1">
                            {history.length} attempts
                        </p>
                    </div>
                </div>

                {/* Progress Chart */}
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 h-[400px]">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                        <Activity size={18} className="text-blue-400" />
                        Progress (Watts)
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#525252"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#525252"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                domain={['dataMin - 10', 'auto']}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Line type="monotone" dataKey="watts" stroke="#34d399" strokeWidth={3} dot={{ fill: '#34d399', r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* List of Attempts */}
                <div className="bg-neutral-900/30 border border-neutral-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-900/80 text-neutral-400 font-medium uppercase tracking-wider text-xs border-b border-neutral-800">
                            <tr>
                                <th className="p-4 pl-6">Date</th>
                                <th className="p-4">Result</th>
                                <th className="p-4">Watts</th>
                                <th className="p-4">Pace</th>
                                <th className="p-4 pr-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {history.map((h) => {

                                return (
                                    <tr key={h.id} className="hover:bg-neutral-800/40 transition-colors group">
                                        <td className="p-4 pl-6 text-white font-medium">
                                            {/* Date */}
                                            {new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="p-4 text-neutral-300 font-mono">
                                            {/* Result: Matches Detail Header format */}
                                            {h.distance}m / {(() => {
                                                const totalSeconds = h.time;
                                                const m = Math.floor(totalSeconds / 60);
                                                const s = (totalSeconds % 60).toFixed(1);
                                                return `${m}:${s.padStart(4, '0')}`;
                                            })()}
                                        </td>
                                        <td className="p-4 text-emerald-400 font-bold font-mono">
                                            {h.watts}w
                                        </td>
                                        <td className="p-4 text-blue-400 font-mono">
                                            {/* Pace: h.avg_split is in SECONDS per 500m */}
                                            {(() => {
                                                const val = h.avg_split || 0;
                                                const m = Math.floor(val / 60);
                                                const s = (val % 60).toFixed(1);
                                                return `${m}:${s.padStart(4, '0')}`;
                                            })()}/500m
                                        </td>
                                        <td className="p-4 pr-6 text-right">
                                            <Link
                                                to={`/workout/${h.id}`}
                                                className="text-neutral-500 hover:text-white transition-colors text-xs border border-neutral-800 hover:border-neutral-600 rounded px-2 py-1"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
};
