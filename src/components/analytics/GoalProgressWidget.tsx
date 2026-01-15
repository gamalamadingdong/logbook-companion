import React, { useEffect, useState, useMemo } from 'react';
import { type UserGoal, getUserGoals } from '../../services/supabase';
import { calculateWatts, calculatePaceFromWatts, formatPace, formatWatts, calculatePRs, type PRRecord } from '../../utils/prCalculator';
import { fetchUserPRs } from '../../utils/prDetection';
import { Trophy, Target, Calendar, Clock, ArrowRight, CheckCircle2, Circle } from 'lucide-react';

interface GoalProgressWidgetProps {
    userId: string;
    workouts: any[]; // All workouts (for PR calc) or recent workouts? 
    // Ideally we pass ALL workouts so we can calculate PRs on the fly 
    // OR we rely on the `fetchUserPRs` which queries DB/Cache.
}

export const GoalProgressWidget: React.FC<GoalProgressWidgetProps> = ({ userId, workouts }) => {
    const [goals, setGoals] = useState<UserGoal[]>([]);
    const [prs, setPrs] = useState<PRRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Get current week's workouts
    const currentWeekWorkouts = useMemo(() => {
        const now = new Date();
        const day = now.getDay(); // 0=Sun, 1=Mon
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        return workouts.filter(w => new Date(w.completed_at) >= monday);
    }, [workouts]);

    // Calculate Weekly Metrics
    const weeklyStats = useMemo(() => {
        return currentWeekWorkouts.reduce((acc, w) => ({
            distance: acc.distance + (w.distance_meters || 0),
            time: acc.time + (w.duration_seconds || (w.duration_minutes * 60) || 0),
            sessions: acc.sessions + 1
        }), { distance: 0, time: 0, sessions: 0 });
    }, [currentWeekWorkouts]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [g, p] = await Promise.all([
                    getUserGoals(userId),
                    fetchUserPRs(userId)
                ]);
                setGoals(g.filter(x => x.is_active));
                setPrs(p);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [userId]);

    if (loading) return <div className="animate-pulse h-24 bg-neutral-900/50 rounded-xl mb-6" />;
    if (goals.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {goals.map(goal => {
                let current = 0;
                let target = goal.target_value;
                let label = '';
                let subLabel = '';
                let percent = 0;
                let icon = <Target size={20} className="text-emerald-400" />;
                let colorClass = 'bg-emerald-500';

                // Weekly Distance
                if (goal.type === 'weekly_distance') {
                    current = weeklyStats.distance;
                    target = goal.target_value;
                    percent = Math.min(100, (current / target) * 100);
                    label = 'Weekly Distance';
                    subLabel = `${(current / 1000).toFixed(1)} / ${(target / 1000).toFixed(1)} km`;
                    icon = <Calendar size={20} className="text-blue-400" />;
                    colorClass = 'bg-blue-500';
                }
                // Weekly Time
                else if (goal.type === 'weekly_time') {
                    current = weeklyStats.time; // seconds
                    // Target stored as seconds (from minutes input * 60) ? 
                    // Wait, in previous step I stored it as: `parseFloat(newValue) * 60`. 
                    // So yes, target is seconds.
                    percent = Math.min(100, (current / target) * 100);
                    label = 'Weekly Time';
                    // Display in hours if > 60m? Or minutes.
                    const currMins = Math.round(current / 60);
                    const targMins = Math.round(target / 60);
                    subLabel = `${currMins} / ${targMins} mins`;
                    icon = <Clock size={20} className="text-amber-400" />;
                    colorClass = 'bg-amber-500';
                }
                // Weekly Sessions
                else if (goal.type === 'weekly_sessions') {
                    current = weeklyStats.sessions;
                    percent = Math.min(100, (current / target) * 100);
                    label = 'Weekly Sessions';
                    subLabel = `${current} / ${target}`;
                    icon = <ActivityIcon />;
                    colorClass = 'bg-purple-500';
                }
                // Benchmark Goal
                else if (goal.type === 'benchmark_goal') {
                    // Target is WATTS
                    // Current is Best Watts for this distance/key
                    const pr = prs.find(p =>
                        p.label === goal.metric_key ||
                        p.shortLabel === goal.metric_key ||
                        // Fuzzy Match Fallbacks for Legacy/Dirty Data
                        (goal.metric_key === '2000m' && p.label === '2k') ||
                        (goal.metric_key === '5000m' && p.label === '5k') ||
                        (goal.metric_key === '6000m' && p.label === '6k') ||
                        (goal.metric_key === '10000m' && p.label === '10k')
                    );
                    const currentPace = pr ? pr.pace : 0;
                    const currentWatts = pr ? calculateWatts(pr.pace) : 0;

                    // IF goal is Watts (higher is better)
                    current = currentWatts;
                    target = goal.target_value;
                    percent = Math.min(100, (current / target) * 100);

                    label = `Target ${goal.metric_key}`;

                    const targetPace = calculatePaceFromWatts(target);
                    subLabel = `${formatPace(currentPace)} -> ${formatPace(targetPace)}`;

                    icon = <Trophy size={20} className="text-yellow-400" />;
                    colorClass = 'bg-yellow-500';
                }

                const isCompleted = percent >= 100;

                // Deadline Calc
                let daysLeft = null;
                if (goal.deadline) {
                    const diff = new Date(goal.deadline).getTime() - new Date().getTime();
                    daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                }

                return (
                    <div key={goal.id} className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group">
                        {/* Progress Bar Background */}
                        <div className="absolute bottom-0 left-0 h-1 bg-neutral-800 w-full">
                            <div
                                className={`h-full transition-all duration-1000 ${colorClass}`}
                                style={{ width: `${percent}%` }}
                            />
                        </div>

                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-neutral-800 ${isCompleted ? 'text-emerald-400' : 'text-neutral-400'}`}>
                                    {isCompleted ? <CheckCircle2 size={20} /> : icon}
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-neutral-200">{label}</h4>
                                    <p className="text-xs text-neutral-400 font-mono mt-0.5">{subLabel}</p>

                                    {daysLeft !== null && !isCompleted && (
                                        <p className={`text-[10px] font-bold mt-1 ${daysLeft < 7 ? 'text-rose-400' : 'text-neutral-500'}`}>
                                            {daysLeft < 0 ? 'Overdue' : `${daysLeft} days left`}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <span className="text-lg font-bold text-white font-mono">{Math.round(percent)}%</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ActivityIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);
