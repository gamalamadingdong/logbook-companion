import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Activity, Link as LinkIcon, X, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { workoutService } from '../services/workoutService';
import { supabase } from '../services/supabase';
import type { WorkoutStructure } from '../types/workoutStructure.types';

export const WorkoutHistory: React.FC = () => {
    const { name } = useParams<{ name: string }>();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Bulk Template Linking State
    const [showTemplateLinking, setShowTemplateLinking] = useState(false);
    const [availableTemplates, setAvailableTemplates] = useState<Array<{
        id: string;
        name: string;
        rwn: string | null;
        workout_type: string;
        training_zone: string | null;
        workout_structure: WorkoutStructure | null;
        is_steady_state: boolean;
        is_interval: boolean;
        estimated_duration: number | null;
        distance: number | null;
    }>>([]);
    const [templateSearch, setTemplateSearch] = useState('');
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [linking, setLinking] = useState(false);

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
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">
                                History: <span className="text-emerald-500">{workoutName}</span>
                            </h1>
                            <p className="text-neutral-500 mt-1">
                                {history.length} attempts
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                setShowTemplateLinking(true);
                                setLoadingTemplates(true);
                                try {
                                    const { data, error } = await supabase
                                        .from('workout_templates')
                                        .select('id, name, rwn, workout_type, training_zone, workout_structure, is_steady_state, is_interval, estimated_duration, distance')
                                        .eq('workout_type', 'erg')
                                        .order('name', { ascending: true });
                                    
                                    if (error) throw error;
                                    setAvailableTemplates(data || []);
                                } catch (err) {
                                    console.error('Failed to load templates:', err);
                                } finally {
                                    setLoadingTemplates(false);
                                }
                            }}
                            className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 px-4 py-2 rounded-xl transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <LinkIcon size={16} />
                            Link Template to All
                        </button>
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

            {/* Template Linking Modal */}
            {showTemplateLinking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Link Template to All Workouts</h2>
                                <p className="text-sm text-neutral-400 mt-0.5">
                                    This will link the selected template to all {history.length} workouts in this history
                                </p>
                            </div>
                            <button
                                onClick={() => setShowTemplateLinking(false)}
                                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                                aria-label="Close template linking"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-neutral-800">
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                <input
                                    type="text"
                                    value={templateSearch}
                                    onChange={(e) => setTemplateSearch(e.target.value)}
                                    placeholder="Search templates..."
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Template List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loadingTemplates ? (
                                <div className="text-center py-8 text-neutral-400">
                                    Loading templates...
                                </div>
                            ) : availableTemplates.filter(t => 
                                !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())
                            ).length === 0 ? (
                                <div className="text-center py-8 text-neutral-400">
                                    {templateSearch ? 'No templates found matching your search' : 'No templates available'}
                                </div>
                            ) : (
                                availableTemplates
                                    .filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                                    .map((template) => {
                                        const structureType = template.is_steady_state 
                                            ? 'Steady State' 
                                            : template.is_interval 
                                                ? 'Interval' 
                                                : template.workout_structure 
                                                    ? 'Variable' 
                                                    : 'Unknown';
                                        
                                        const workoutInfo = template.distance 
                                            ? `${template.distance}m`
                                            : template.estimated_duration
                                                ? `${Math.floor(template.estimated_duration / 60)}min`
                                                : '';

                                        return (
                                            <button
                                                key={template.id}
                                                onClick={async () => {
                                                    if (!window.confirm(
                                                        `Link "${template.name}" to all ${history.length} workouts in this history?\n\n` +
                                                        `This will update all "${workoutName}" workouts.`
                                                    )) {
                                                        return;
                                                    }

                                                    setLinking(true);
                                                    try {
                                                        // Get all workout IDs that need linking
                                                        const workoutIds = history.map(h => h.db_id).filter(Boolean);
                                                        
                                                        if (workoutIds.length === 0) {
                                                            alert('No workout database IDs found');
                                                            return;
                                                        }

                                                        // Bulk update via Supabase
                                                        const { error } = await supabase
                                                            .from('workout_logs')
                                                            .update({ template_id: template.id })
                                                            .in('id', workoutIds);

                                                        if (error) throw error;

                                                        alert(`Successfully linked ${workoutIds.length} workouts to "${template.name}"`);
                                                        setShowTemplateLinking(false);
                                                    } catch (err) {
                                                        console.error('Failed to link templates:', err);
                                                        alert('Failed to link templates. See console for details.');
                                                    } finally {
                                                        setLinking(false);
                                                    }
                                                }}
                                                disabled={linking}
                                                className="w-full text-left bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded-lg p-4 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div className="flex-1">
                                                        <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors mb-1">
                                                            {template.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {template.training_zone && (
                                                                <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                                                                    {template.training_zone}
                                                                </span>
                                                            )}
                                                            <span className="text-xs bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded">
                                                                {structureType}
                                                            </span>
                                                            {workoutInfo && (
                                                                <span className="text-xs text-neutral-400">
                                                                    {workoutInfo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <LinkIcon size={18} className="text-neutral-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                                                </div>
                                                {template.rwn && (
                                                    <div className="mt-2 pt-2 border-t border-neutral-700/50">
                                                        <code className="text-xs text-neutral-400 font-mono break-all">
                                                            {template.rwn}
                                                        </code>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
