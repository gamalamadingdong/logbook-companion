import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// import { getResults } from '../api/concept2'; // Removed
import { workoutService } from '../services/workoutService';

interface RecentWorkoutsProps {
    userId?: number | string; // Optional now
}

export const RecentWorkouts: React.FC<RecentWorkoutsProps> = () => {
    const [workouts, setWorkouts] = useState<any[]>([]); // Relaxed type for mapped data
    const [loading, setLoading] = useState(true);

    const loadWorkouts = async () => {
        try {
            const data = await workoutService.getRecentWorkouts(20);
            setWorkouts(data);
        } catch (err: any) {
            console.error('Failed to load workouts from DB', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWorkouts();
    }, []);

    if (loading) return <div className="text-neutral-400">Loading workouts...</div>;
    // Removed error and no workouts checks, the table will just be empty if no workouts

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
                                    {/* Use pre-formatted time from service if available, else standard fallback */}
                                    {workout.time_formatted || (workout.time ? (workout.time / 10).toFixed(1) + 's' : '-')}
                                </td>
                                <td className="py-4">
                                    <div>
                                        <div className="text-sm font-medium text-white">{workout.name}</div>
                                        <div className="text-xs text-neutral-500 capitalize">{workout.type.replace(/([A-Z])/g, ' $1').trim()}</div>
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
            {workouts.length === 0 && (
                <div className="text-center py-12 text-neutral-500">
                    No workouts found. Sync your logbook to get started.
                </div>
            )}
        </div>
    );
};
