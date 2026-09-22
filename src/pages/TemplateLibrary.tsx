import React, { useState, useEffect, useCallback } from 'react';
import { Search, Check, X, Edit, Filter, Plus, Trash2, Play, Library, ShieldCheck, Sparkles, FilePlus2 } from 'lucide-react';
import { EmptyState } from '../components/ui';
import { TrainingLibraryTabs } from '../components/TrainingLibraryTabs';
import { fetchOwnedTemplateIds, fetchTemplates, deleteTemplate } from '../services/templateService';
import type { WorkoutTemplateListItem, WorkoutTemplateTier } from '../types/workoutStructure.types';
import { TemplateEditor } from '../components/TemplateEditor';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { toast } from 'sonner';

const TRAINING_ZONES = ['UT2', 'UT1', 'AT', 'TR', 'AN'] as const;

const getTemplateTier = (template: WorkoutTemplateListItem): WorkoutTemplateTier => {
    if (template.status !== 'published') return 'draft';
    return template.validated ? 'standard' : 'community';
};

const getTierBadge = (tier: WorkoutTemplateTier) => {
    switch (tier) {
        case 'standard':
            return {
                label: 'Standard',
                className: 'bg-emerald-500/10 text-emerald-300',
                icon: <ShieldCheck size={14} />,
            };
        case 'community':
            return {
                label: 'Community',
                className: 'bg-blue-500/10 text-blue-300',
                icon: <Sparkles size={14} />,
            };
        default:
            return {
                label: 'Draft',
                className: 'bg-neutral-700/60 text-neutral-200',
                icon: <FilePlus2 size={14} />,
            };
    }
};

export const TemplateLibrary: React.FC = () => {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();

    const [templates, setTemplates] = useState<WorkoutTemplateListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalWorkoutsLinked, setTotalWorkoutsLinked] = useState(0);
    const [search, setSearch] = useState('');
    const [zoneFilter, setZoneFilter] = useState<string>('');
    const [structureFilter, setStructureFilter] = useState<'all' | 'has' | 'missing'>('all');
    const [sortOrder, setSortOrder] = useState<'popular' | 'recent'>('popular');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [ownedTemplateIds, setOwnedTemplateIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchTemplates({
                workoutType: 'erg',
                trainingZone: zoneFilter || undefined,
                hasStructure: structureFilter === 'all' ? undefined : structureFilter === 'has',
                search: search || undefined,
                sortBy: sortOrder
            });
            setTemplates(data);

            if (user?.id) {
                const ownedIds = await fetchOwnedTemplateIds(
                    data.map(template => template.id),
                    user.id,
                );
                setOwnedTemplateIds(new Set(ownedIds));
            } else {
                setOwnedTemplateIds(new Set());
            }
            
            // Calculate total of YOUR workouts linked to templates
            if (user?.id) {
                const { count, error } = await supabase
                    .from('workout_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .not('template_id', 'is', null);
                
                if (!error && count !== null) {
                    setTotalWorkoutsLinked(count);
                }
            }
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoading(false);
        }
    }, [search, zoneFilter, structureFilter, sortOrder, user?.id]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadTemplates();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, loadTemplates]);

    const handleEditorClose = (saved: boolean) => {
        setEditingId(null);
        if (saved) {
            loadTemplates();
        }
    };

    const handleDelete = async (template: WorkoutTemplateListItem) => {
        if (!isAdmin) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete "${template.name}"?\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            await deleteTemplate(template.id);
            loadTemplates();
        } catch (err) {
            console.error('Failed to delete template:', err);
            toast.error('Failed to delete template. Please try again.');
        }
    };

    const handleBulkDelete = async () => {
        if (!isAdmin || selectedIds.size === 0) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete ${selectedIds.size} template(s)?\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        setDeleting(true);
        try {
            await Promise.all(
                Array.from(selectedIds).map(id => deleteTemplate(id))
            );
            setSelectedIds(new Set());
            loadTemplates();
        } catch (err) {
            console.error('Failed to delete templates:', err);
            toast.error('Failed to delete some templates. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === templates.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(templates.map(t => t.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    return (
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Training Library</h1>
                    <p className="text-neutral-400 text-sm mt-1">
                        Find reusable rowing workouts and strength and mobility sessions for your training.
                    </p>
                </div>
                <TrainingLibraryTabs activeMode="rowing" />
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
                    {isAdmin && selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={deleting}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-800"
                        >
                            <Trash2 size={18} />
                            Delete {selectedIds.size} Selected
                        </button>
                    )}
                    {isAdmin && (
                        <Link
                            to="/library/review"
                            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-white transition-colors hover:bg-neutral-700"
                        >
                            <ShieldCheck size={18} />
                            Review Proposals
                        </Link>
                    )}
                    {user && (
                        <button
                            onClick={() => setEditingId('new')}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-white transition-colors hover:bg-neutral-700"
                        >
                            <Plus size={18} />
                            New Draft
                        </button>
                    )}
                    <Link
                        to="/library/propose"
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-500"
                    >
                        <FilePlus2 size={18} />
                        Propose Workout
                    </Link>
                </div>
            </div>

            {/* Filters Row */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                {/* Search */}
                <div className="relative min-w-0 flex-1 sm:col-span-2 lg:col-span-1 lg:min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2 pl-10 pr-4 text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                    />
                </div>

                {/* Zone Filter */}
                <select
                    value={zoneFilter}
                    onChange={e => setZoneFilter(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none lg:w-auto"
                    aria-label="Filter by training zone"
                >
                    <option value="">All Zones</option>
                    {TRAINING_ZONES.map(zone => (
                        <option key={zone} value={zone}>{zone}</option>
                    ))}
                </select>

                {/* Sort Order */}
                <select
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value as 'popular' | 'recent')}
                    className="min-h-11 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none lg:w-auto"
                    aria-label="Sort templates by"
                >
                    <option value="popular">Most Popular</option>
                    <option value="recent">Recently Used</option>
                </select>

                {/* Structure Filter */}
                <div className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3">
                    <Filter size={16} className="text-neutral-500" />
                    <select
                        value={structureFilter}
                        onChange={e => setStructureFilter(e.target.value as 'all' | 'has' | 'missing')}
                        className="bg-transparent py-2 text-white focus:outline-none"
                        aria-label="Filter by structure status"
                    >
                        <option value="all">All Status</option>
                        <option value="has">✓ Standardized</option>
                        <option value="missing">✗ Needs Structure</option>
                    </select>
                </div>
            </div>

            {/* Summary */}
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <span className="text-neutral-400">
                    {templates.length} templates
                </span>
                <span className="text-emerald-400">
                    {templates.filter(t => getTemplateTier(t) === 'standard').length} standard
                </span>
                <span className="text-indigo-400">
                    {totalWorkoutsLinked} workouts categorized
                </span>
                <span className="text-blue-400">
                    {templates.filter(t => getTemplateTier(t) === 'community').length} community
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
                    <EmptyState
                        icon={<Library className="w-8 h-8" />}
                        title="No templates yet"
                        description="Browse published workouts or submit one to the community review queue."
                        action={
                            <Link
                                to="/library/propose"
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm"
                            >
                                <FilePlus2 className="w-4 h-4 inline mr-1" />
                                Propose Workout
                            </Link>
                        }
                    />
                ) : (
                    <>
                    <div className="divide-y divide-neutral-800 md:hidden">
                        {templates.map(template => {
                            const badge = getTierBadge(getTemplateTier(template));
                            return (
                                <article key={template.id} className="space-y-3 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <span className={`${badge.className} inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium`}>
                                                {badge.icon}{badge.label}
                                            </span>
                                            <h2 className="mt-2 text-base font-semibold text-white">{template.name}</h2>
                                            <p className="mt-1 text-xs text-neutral-400">{template.training_zone || 'No zone'} · {template.difficulty_level || 'No difficulty'}</p>
                                        </div>
                                        {isAdmin && (
                                            <input type="checkbox" checked={selectedIds.has(template.id)} onChange={() => toggleSelect(template.id)} className="h-6 w-6 rounded border-neutral-600 bg-neutral-800 text-emerald-600 focus:ring-emerald-500" aria-label={`Select ${template.name}`} />
                                        )}
                                    </div>
                                    <p className={`flex items-center gap-1 text-xs ${template.workout_structure ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {template.workout_structure ? <Check size={14} /> : <X size={14} />}
                                        {template.workout_structure ? 'RWN standardized' : 'Needs structure'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => navigate(`/library/${template.id}`)} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500">
                                            <Play size={16} /> Details
                                        </button>
                                        {(isAdmin || ownedTemplateIds.has(template.id)) ? (
                                            <button onClick={() => setEditingId(template.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 text-sm text-neutral-200 hover:border-emerald-500">
                                                <Edit size={16} /> Edit
                                            </button>
                                        ) : <span />}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                    <table className="hidden w-full md:table">
                        <thead className="bg-neutral-800/50">
                            <tr className="text-left text-neutral-400 text-sm">
                                {isAdmin && (
                                    <th className="px-4 py-3 w-12">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === templates.length && templates.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-neutral-900"
                                            aria-label="Select all templates"
                                        />
                                    </th>
                                )}
                                <th className="px-4 py-3 font-medium">Tier</th>
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Zone</th>
                                <th className="px-4 py-3 font-medium">Difficulty</th>
                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {templates.map(template => (
                                <tr key={template.id} className="hover:bg-neutral-800/30 transition-colors">
                                    {isAdmin && (
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(template.id)}
                                                onChange={() => toggleSelect(template.id)}
                                                className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-neutral-900"
                                                aria-label={`Select ${template.name}`}
                                            />
                                        </td>
                                    )}
                                    <td className="px-4 py-3">
                                        {(() => {
                                            const badge = getTierBadge(getTemplateTier(template));
                                            return (
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                                                    {badge.icon}
                                                    {badge.label}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-white font-medium">{template.name}</span>
                                            {template.workout_structure ? (
                                                <span className="flex items-center gap-1 text-emerald-400 text-xs">
                                                    <Check size={14} /> RWN standardized
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-amber-400 text-xs">
                                                    <X size={14} /> Needs structure
                                                </span>
                                            )}
                                        </div>
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
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => navigate(`/library/${template.id}`)}
                                                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
                                                title="View template details"
                                            >
                                                <Play size={14} />
                                                See Details
                                            </button>
                                            {(isAdmin || ownedTemplateIds.has(template.id)) && (
                                                <button
                                                    onClick={() => setEditingId(template.id)}
                                                    className="p-2 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                                                    title="Edit template"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                            )}
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDelete(template)}
                                                    className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Delete template"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </>
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
