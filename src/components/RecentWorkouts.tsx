import React from 'react';
import { Link } from 'react-router-dom';
import { Bike, Snowflake, Waves, Activity, ChevronLeft, ChevronRight } from 'lucide-react';

interface RecentWorkoutsProps {
    userId?: number | string;
    workouts: any[];
    isLoading?: boolean;
    currentPage: number;
    hasMore: boolean;
    onPageChange: (newPage: number) => void;
}

export const RecentWorkouts: React.FC<RecentWorkoutsProps> = ({
    workouts,
    isLoading = false,
    currentPage,
    hasMore,
    onPageChange
}) => {

    if (isLoading && workouts.length === 0) return <div className="text-neutral-400 p-6 animate-pulse">Loading workouts...</div>;

    const getMachineIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('bike')) return <Bike size={16} className="text-amber-400" />;
        if (t.includes('ski')) return <Snowflake size={16} className="text-cyan-400" />;
        return <Waves size={16} className="text-emerald-400" />;
    };

    const formatMachineType = (type: string) => {
        // Concept2 returns "rower", "bike", "skierg"
        if (type === 'rower') return 'RowErg';
        if (type === 'bike') return 'BikeErg';
        if (type === 'skierg') return 'SkiErg';
        return type.replace(/([A-Z])/g, ' $1').trim();
    };

    return (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Recent Workouts</h2>
                    <p className="text-neutral-400 text-sm">Your latest activity from the Logbook</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-neutral-800 text-neutral-400 text-xs font-semibold uppercase tracking-wider">
                            <th className="pb-4 pl-4">Date</th>
                            <th className="pb-4">Distance</th>
                            <th className="pb-4">Time</th>
                            <th className="pb-4">Workout</th>
                            <th className="pb-4 pr-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                        {workouts.map((workout) => (
                            <tr key={workout.id} className="text-sm hover:bg-neutral-800/40 transition-colors group">
                                <td className="py-4 pl-4 text-neutral-300 font-medium">
                                    {new Date(workout.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="py-4 font-mono text-white text-base">{workout.distance}m</td>
                                <td className="py-4 font-mono text-emerald-400 font-medium">
                                    {workout.time_formatted || (workout.time ? (workout.time / 10).toFixed(1) + 's' : '-')}
                                </td>
                                <td className="py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-neutral-800 rounded-lg">
                                            {getMachineIcon(workout.type || 'rower')}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white">{workout.name}</div>
                                            <div className="text-xs text-neutral-500">{formatMachineType(workout.type || '')}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 pr-4 text-right">
                                    <Link
                                        to={`/workout/${workout.id}`}
                                        className="text-indigo-400 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500 hover:border-indigo-500 transition-all inline-block"
                                    >
                                        Analyze
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {
                workouts.length > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-neutral-800">
                        <p className="text-sm text-neutral-500">
                            Page <span className="text-neutral-300 font-medium">{currentPage + 1}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage === 0 || isLoading}
                                className="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1"
                            >
                                <ChevronLeft size={14} />
                                Previous
                            </button>
                            <button
                                onClick={() => onPageChange(currentPage + 1)}
                                disabled={!hasMore || isLoading}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1"
                            >
                                {isLoading ? 'Loading...' : <>Next <ChevronRight size={14} /></>}
                            </button>
                        </div>
                    </div>
                )
            }

            {
                workouts.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-neutral-500">
                        No workouts found. Sync your logbook to get started.
                    </div>
                )
            }
        </div >
    );
};
