import React, { useState, useEffect } from 'react';
import { Search, Check, X, Edit, Filter, Plus } from 'lucide-react';
import { fetchTemplates } from '../services/templateService';
import type { WorkoutTemplateListItem } from '../types/workoutStructure.types';
import { TemplateEditor } from '../components/TemplateEditor';

const TRAINING_ZONES = ['UT2', 'UT1', 'AT', 'TR', 'AN'] as const;

export const TemplateLibrary: React.FC = () => {
    const [templates, setTemplates] = useState<WorkoutTemplateListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [zoneFilter, setZoneFilter] = useState<string>('');
    const [structureFilter, setStructureFilter] = useState<'all' | 'has' | 'missing'>('all');
    const [editingId, setEditingId] = useState<string | null>(null);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await fetchTemplates({
                workoutType: 'erg',
                trainingZone: zoneFilter || undefined,
                hasStructure: structureFilter === 'all' ? undefined : structureFilter === 'has',
                search: search || undefined
            });
            setTemplates(data);
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, [zoneFilter, structureFilter]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadTemplates();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleEditorClose = (saved: boolean) => {
        setEditingId(null);
        if (saved) {
            loadTemplates();
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Template Library</h1>
                    <p className="text-neutral-400 text-sm mt-1">
                        Manage workout templates and add programmable structures
                    </p>
                </div>
                <button
                    onClick={() => setEditingId('new')}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus size={18} />
                    New Template
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                </div>

                {/* Zone Filter */}
                <select
                    value={zoneFilter}
                    onChange={e => setZoneFilter(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                    <option value="">All Zones</option>
                    {TRAINING_ZONES.map(zone => (
                        <option key={zone} value={zone}>{zone}</option>
                    ))}
                </select>

                {/* Structure Filter */}
                <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3">
                    <Filter size={16} className="text-neutral-500" />
                    <select
                        value={structureFilter}
                        onChange={e => setStructureFilter(e.target.value as any)}
                        className="bg-transparent py-2 text-white focus:outline-none"
                    >
                        <option value="all">All Status</option>
                        <option value="has">✓ Programmable</option>
                        <option value="missing">✗ Needs Structure</option>
                    </select>
                </div>
            </div>

            {/* Summary */}
            <div className="flex gap-4 mb-4 text-sm">
                <span className="text-neutral-400">
                    {templates.length} templates
                </span>
                <span className="text-emerald-400">
                    {templates.filter(t => t.workout_structure).length} programmable
                </span>
                <span className="text-amber-400">
                    {templates.filter(t => !t.workout_structure).length} need structure
                </span>
            </div>

            {/* Table */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-neutral-500">Loading templates...</div>
                ) : templates.length === 0 ? (
                    <div className="p-12 text-center text-neutral-500">No templates found</div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-neutral-800/50">
                            <tr className="text-left text-neutral-400 text-sm">
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Zone</th>
                                <th className="px-4 py-3 font-medium">Difficulty</th>
                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {templates.map(template => (
                                <tr key={template.id} className="hover:bg-neutral-800/30 transition-colors">
                                    <td className="px-4 py-3">
                                        {template.workout_structure ? (
                                            <span className="flex items-center gap-1 text-emerald-400 text-sm">
                                                <Check size={16} /> Programmable
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-amber-400 text-sm">
                                                <X size={16} /> Text Only
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-white font-medium">{template.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {template.training_zone ? (
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${template.training_zone === 'UT2' ? 'bg-blue-900/50 text-blue-300' :
                                                    template.training_zone === 'UT1' ? 'bg-cyan-900/50 text-cyan-300' :
                                                        template.training_zone === 'AT' ? 'bg-yellow-900/50 text-yellow-300' :
                                                            template.training_zone === 'TR' ? 'bg-orange-900/50 text-orange-300' :
                                                                'bg-red-900/50 text-red-300'
                                                }`}>
                                                {template.training_zone}
                                            </span>
                                        ) : (
                                            <span className="text-neutral-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-400 text-sm capitalize">
                                        {template.difficulty_level}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setEditingId(template.id)}
                                            className="p-2 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                                            title="Edit template"
                                        >
                                            <Edit size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Editor Modal */}
            {editingId && (
                <TemplateEditor
                    templateId={editingId === 'new' ? null : editingId}
                    onClose={handleEditorClose}
                />
            )}
        </div>
    );
};
