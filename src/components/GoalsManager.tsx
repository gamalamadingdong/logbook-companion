import React, { useState, useEffect } from 'react';
import { supabase, getUserGoals, saveUserGoal, type UserGoal } from '../services/supabase';
import { calculateWatts, calculatePaceFromWatts, formatPace, formatWatts, PR_DISTANCES } from '../utils/prCalculator';
import { Target, Calendar, Clock, Trophy, Trash2, Plus, Save } from 'lucide-react';

interface GoalsManagerProps {
    userId: string;
}

export const GoalsManager: React.FC<GoalsManagerProps> = ({ userId }) => {
    const [goals, setGoals] = useState<UserGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Form State
    const [newType, setNewType] = useState<UserGoal['type']>('weekly_distance');
    const [newMetricKey, setNewMetricKey] = useState<string>('2000m'); // e.g., '2000m', '30:00'
    const [newValue, setNewValue] = useState<string>(''); // Raw input
    const [splitInput, setSplitInput] = useState<string>(''); // MM:SS
    const [deadline, setDeadline] = useState<string>(''); // YYYY-MM-DD

    // Load goals on mount
    useEffect(() => {
        loadGoals();
    }, [userId]);

    const loadGoals = async () => {
        setLoading(true);
        try {
            const data = await getUserGoals(userId);
            setGoals(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (goalId: string) => {
        if (!confirm('Remove this goal?')) return;
        const { error } = await supabase
            .from('user_goals')
            .update({ is_active: false })
            .eq('id', goalId);

        if (!error) loadGoals();
    };

    const handleSave = async () => {
        if (!newValue && !splitInput) return;

        let finalValue = parseFloat(newValue);
        let finalKey = null;

        if (newType === 'weekly_distance') {
            // Input is in km usually? Let's assume meters for consistency or ask user.
            // Let's assume input is in Meters for now to be safe, standard.
            finalValue = parseFloat(newValue);
        } else if (newType === 'weekly_time') {
            // Input in minutes?
            finalValue = parseFloat(newValue) * 60; // Store as seconds? Or minutes? 
            // Schema doesn't specify unit. Let's decide: Distance=Meters, Time=Seconds, Watts=Watts.
        } else if (newType === 'benchmark_goal') {
            finalKey = newMetricKey;
            // Input is MM:SS (Split) -> Convert to Watts
            // Parse MM:SS
            const parts = splitInput.split(':');
            let seconds = 0;
            if (parts.length === 2) {
                seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            } else {
                seconds = parseFloat(splitInput);
            }
            // Standardize to Watts
            finalValue = calculateWatts(seconds);
        }

        try {
            await saveUserGoal({
                user_id: userId,
                type: newType,
                metric_key: finalKey || undefined,
                target_value: finalValue,
                deadline: deadline || undefined,
                is_active: true
            });
            setIsAdding(false);
            setNewValue('');
            setSplitInput('');
            setDeadline('');
            loadGoals();
        } catch (e) {
            console.error(e);
            alert('Failed to save goal.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Trophy size={18} className="text-yellow-500" />
                        Active Goals
                    </h3>
                    <p className="text-neutral-400 text-sm">Track your weekly volume and performance targets.</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors text-sm font-medium"
                    >
                        <Plus size={16} />
                        Add Goal
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-neutral-800/50 p-4 rounded-xl border border-neutral-700 animate-in fade-in slide-in-from-top-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-1">Goal Type</label>
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as any)}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none"
                            >
                                <option value="weekly_distance">Weekly Distance</option>
                                <option value="weekly_time">Weekly Time</option>
                                <option value="weekly_sessions">Weekly Sessions</option>
                                <option value="benchmark_goal">Benchmark Target</option>
                            </select>
                        </div>

                        {newType === 'benchmark_goal' ? (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-400 mb-1">Benchmark</label>
                                    <select
                                        value={newMetricKey}
                                        onChange={(e) => setNewMetricKey(e.target.value)}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                    >
                                        <option value="500m">500m</option>
                                        <option value="2000m">2000m</option>
                                        <option value="5000m">5000m</option>
                                        <option value="6000m">6000m</option>
                                        <option value="10000m">10k</option>
                                        <option value="30:00">30:00</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-400 mb-1">Target Split (MM:SS.t /500m)</label>
                                        <input
                                            type="text"
                                            placeholder="1:45.0"
                                            value={splitInput}
                                            onChange={(e) => setSplitInput(e.target.value)}
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-400 mb-1">Deadline (Optional)</label>
                                        <input
                                            type="date"
                                            value={deadline}
                                            onChange={(e) => setDeadline(e.target.value)}
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none [color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-xs font-medium text-neutral-400 mb-1">
                                    Target Value
                                    {newType === 'weekly_distance' && ' (Meters)'}
                                    {newType === 'weekly_time' && ' (Minutes)'}
                                    {newType === 'weekly_sessions' && ' (Count)'}
                                </label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-3 py-2 text-neutral-400 hover:text-white text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Save size={16} />
                            Save Goal
                        </button>
                    </div>
                </div>
            )
            }

            <div className="space-y-3">
                {loading ? (
                    <div className="text-neutral-500 text-sm animate-pulse">Loading goals...</div>
                ) : goals.length === 0 ? (
                    <div className="text-neutral-500 text-sm italic">No active goals found. Set one to stay on track!</div>
                ) : (
                    goals.map(goal => (
                        <div key={goal.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg 
                                    ${goal.type === 'benchmark_goal' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}
                                `}>
                                    {goal.type === 'benchmark_goal' ? <Target size={20} /> : <Calendar size={20} />}
                                </div>
                                <div>
                                    <h4 className="font-medium text-white">
                                        {goal.type === 'weekly_distance' && 'Weekly Distance'}
                                        {goal.type === 'weekly_time' && 'Weekly Time'}
                                        {goal.type === 'weekly_sessions' && 'Weekly Sessions'}
                                        {goal.type === 'benchmark_goal' && `Target ${goal.metric_key}`}
                                    </h4>
                                    <p className="text-neutral-400 text-sm">
                                        Target: {' '}
                                        <span className="text-white font-mono">
                                            {goal.type === 'weekly_distance' && `${(goal.target_value / 1000).toFixed(1)}km`}
                                            {goal.type === 'weekly_time' && `${(goal.target_value / 60).toFixed(0)} mins`}
                                            {/* Note: Saved as Seconds above? No I saved minutes * 60 = seconds. Wait.
                                                In save handler: `parseFloat(newValue) * 60`. 
                                                If input 60 mins -> 3600.
                                                Display: 3600 / 60 = 60 mins. Correct.
                                            */}
                                            {goal.type === 'weekly_sessions' && `${goal.target_value} sessions`}
                                            {goal.type === 'benchmark_goal' && (() => {
                                                const pace = calculatePaceFromWatts(goal.target_value);
                                                return `${formatPace(pace)}/500m (${Math.round(goal.target_value)}W)`;
                                            })()}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(goal.id)}
                                className="p-2 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div >
    );
};
