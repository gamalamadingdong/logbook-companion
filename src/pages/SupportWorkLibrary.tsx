import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Copy, Dumbbell, Edit3, Layers3, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Modal, Select } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import {
    deleteSupportExercise,
    deleteSupportSessionTemplate,
    fetchSupportLibrary,
    saveSupportExercise,
    saveSupportSessionTemplate,
    type SaveSupportTemplateExerciseInput,
    type SupportDifficulty,
    type SupportExerciseRow,
    type SupportKind,
    type SupportLibrary,
    type SupportSessionTemplateWithExercises,
} from '../services/supportWorkService';

const supportKinds: Array<{ value: SupportKind; label: string }> = [
    { value: 'strength', label: 'Strength' },
    { value: 'core', label: 'Core' },
    { value: 'mobility', label: 'Mobility' },
    { value: 'stretching', label: 'Stretching' },
    { value: 'prehab', label: 'Prehab' },
    { value: 'recovery', label: 'Recovery' },
];

const difficulties: Array<{ value: SupportDifficulty; label: string }> = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
];

type TemplateExerciseForm = {
    exerciseId: string;
    sets: string;
    reps: string;
    durationSeconds: string;
    restSeconds: string;
    loadPrescription: string;
    side: '' | 'both' | 'left' | 'right' | 'alternating' | 'per_side';
    notes: string;
};

type TemplateFormState = {
    id?: string;
    title: string;
    kind: SupportKind;
    description: string;
    estimatedDurationMinutes: string;
    difficulty: '' | SupportDifficulty;
    focus: string;
    instructions: string;
    exercises: TemplateExerciseForm[];
};

type ExerciseFormState = {
    id?: string;
    name: string;
    category: SupportKind;
    movementPattern: string;
    equipment: string;
    defaultSets: string;
    defaultReps: string;
    defaultDurationSeconds: string;
    cues: string;
    tags: string;
};

function splitList(value: string): string[] {
    return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function optionalNumber(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function newExerciseForm(): ExerciseFormState {
    return {
        name: '',
        category: 'strength',
        movementPattern: '',
        equipment: '',
        defaultSets: '',
        defaultReps: '',
        defaultDurationSeconds: '',
        cues: '',
        tags: '',
    };
}

function exerciseToForm(exercise: SupportExerciseRow): ExerciseFormState {
    return {
        id: exercise.id,
        name: exercise.name,
        category: exercise.category as SupportKind,
        movementPattern: exercise.movement_pattern ?? '',
        equipment: exercise.equipment.join(', '),
        defaultSets: exercise.default_sets ? String(exercise.default_sets) : '',
        defaultReps: exercise.default_reps ?? '',
        defaultDurationSeconds: exercise.default_duration_seconds ? String(exercise.default_duration_seconds) : '',
        cues: exercise.cues.join('\n'),
        tags: exercise.tags.join(', '),
    };
}

function newTemplateForm(): TemplateFormState {
    return {
        title: '',
        kind: 'strength',
        description: '',
        estimatedDurationMinutes: '',
        difficulty: '',
        focus: '',
        instructions: '',
        exercises: [],
    };
}

function templateToForm(template: SupportSessionTemplateWithExercises): TemplateFormState {
    return {
        id: template.id,
        title: template.title,
        kind: template.kind as SupportKind,
        description: template.description ?? '',
        estimatedDurationMinutes: template.estimated_duration_minutes ? String(template.estimated_duration_minutes) : '',
        difficulty: (template.difficulty as SupportDifficulty | null) ?? '',
        focus: template.focus.join(', '),
        instructions: template.instructions.join('\n'),
        exercises: template.exercises.map((row) => ({
            exerciseId: row.exercise_id,
            sets: row.sets ? String(row.sets) : '',
            reps: row.reps ?? '',
            durationSeconds: row.duration_seconds ? String(row.duration_seconds) : '',
            restSeconds: row.rest_seconds || row.rest_seconds === 0 ? String(row.rest_seconds) : '',
            loadPrescription: row.load_prescription ?? '',
            side: (row.side as TemplateExerciseForm['side']) ?? '',
            notes: row.notes.join('\n'),
        })),
    };
}

function cloneTemplateToForm(template: SupportSessionTemplateWithExercises): TemplateFormState {
    const form = templateToForm(template);
    return {
        ...form,
        id: undefined,
        title: `${template.title} copy`,
    };
}

function toTemplateExerciseInput(row: TemplateExerciseForm, index: number): SaveSupportTemplateExerciseInput {
    return {
        exerciseId: row.exerciseId,
        sortOrder: index + 1,
        sets: optionalNumber(row.sets),
        reps: row.reps || null,
        durationSeconds: optionalNumber(row.durationSeconds),
        restSeconds: optionalNumber(row.restSeconds),
        loadPrescription: row.loadPrescription || null,
        side: row.side || null,
        notes: splitList(row.notes),
    };
}

export const SupportWorkLibrary: React.FC = () => {
    const { user } = useAuth();
    const [library, setLibrary] = useState<SupportLibrary>({ exercises: [], sessionTemplates: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [kindFilter, setKindFilter] = useState<'all' | SupportKind>('all');
    const [activeTab, setActiveTab] = useState<'sessions' | 'exercises'>('sessions');
    const [templateForm, setTemplateForm] = useState<TemplateFormState | null>(null);
    const [exerciseForm, setExerciseForm] = useState<ExerciseFormState | null>(null);
    const [templateFormError, setTemplateFormError] = useState<string | null>(null);
    const [exerciseFormError, setExerciseFormError] = useState<string | null>(null);

    const loadLibrary = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setLibrary(await fetchSupportLibrary());
        } catch (err) {
            console.error('Failed to load support library', err);
            setError('Could not load support work. Try refreshing the page.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadLibrary();
    }, [loadLibrary]);

    const personalExerciseCount = library.exercises.filter((exercise) => exercise.user_id).length;
    const personalTemplateCount = library.sessionTemplates.filter((template) => template.user_id).length;

    const filteredTemplates = useMemo(() => {
        const query = search.trim().toLowerCase();
        return library.sessionTemplates.filter((template) => {
            if (kindFilter !== 'all' && template.kind !== kindFilter) return false;
            if (!query) return true;
            const haystack = [
                template.title,
                template.description ?? '',
                template.kind,
                template.focus.join(' '),
                template.exercises.map((row) => row.exercise?.name ?? '').join(' '),
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }, [kindFilter, library.sessionTemplates, search]);

    const filteredExercises = useMemo(() => {
        const query = search.trim().toLowerCase();
        return library.exercises.filter((exercise) => {
            if (kindFilter !== 'all' && exercise.category !== kindFilter) return false;
            if (!query) return true;
            const haystack = [
                exercise.name,
                exercise.category,
                exercise.movement_pattern ?? '',
                exercise.equipment.join(' '),
                exercise.tags.join(' '),
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }, [kindFilter, library.exercises, search]);

    const canEdit = (ownerUserId: string | null): boolean => Boolean(user?.id && ownerUserId === user.id);

    const saveExercise = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user?.id || !exerciseForm) return;
        setExerciseFormError(null);
        if (!exerciseForm.name.trim()) {
            setExerciseFormError('Exercise name is required.');
            return;
        }

        setSaving(true);
        try {
            await saveSupportExercise({
                id: exerciseForm.id,
                userId: user.id,
                name: exerciseForm.name,
                category: exerciseForm.category,
                movementPattern: exerciseForm.movementPattern,
                equipment: splitList(exerciseForm.equipment),
                defaultSets: optionalNumber(exerciseForm.defaultSets),
                defaultReps: exerciseForm.defaultReps || null,
                defaultDurationSeconds: optionalNumber(exerciseForm.defaultDurationSeconds),
                cues: splitList(exerciseForm.cues),
                tags: splitList(exerciseForm.tags),
            });
            setExerciseForm(null);
            await loadLibrary();
            toast.success('Support exercise saved.');
        } catch (err) {
            console.error('Failed to save support exercise', err);
            toast.error('Could not save support exercise.');
        } finally {
            setSaving(false);
        }
    };

    const saveTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user?.id || !templateForm) return;
        setTemplateFormError(null);
        if (!templateForm.title.trim()) {
            setTemplateFormError('Session title is required.');
            return;
        }

        const selectedExercises = templateForm.exercises.filter((row) => row.exerciseId);
        if (selectedExercises.length === 0) {
            setTemplateFormError('Add at least one exercise before saving the session.');
            return;
        }

        setSaving(true);
        try {
            await saveSupportSessionTemplate({
                id: templateForm.id,
                userId: user.id,
                title: templateForm.title,
                kind: templateForm.kind,
                description: templateForm.description || null,
                estimatedDurationMinutes: optionalNumber(templateForm.estimatedDurationMinutes),
                difficulty: templateForm.difficulty || null,
                focus: splitList(templateForm.focus),
                instructions: splitList(templateForm.instructions),
                exercises: selectedExercises.map(toTemplateExerciseInput),
            });
            setTemplateForm(null);
            await loadLibrary();
            toast.success('Support session saved.');
        } catch (err) {
            console.error('Failed to save support session', err);
            toast.error('Could not save support session.');
        } finally {
            setSaving(false);
        }
    };

    const removeTemplate = async (template: SupportSessionTemplateWithExercises) => {
        if (!canEdit(template.user_id)) return;
        if (!window.confirm(`Delete "${template.title}"? This will not change completed training-block checkoffs.`)) return;

        try {
            await deleteSupportSessionTemplate(template.id);
            await loadLibrary();
            toast.success('Support session deleted.');
        } catch (err) {
            console.error('Failed to delete support session', err);
            toast.error('Could not delete support session.');
        }
    };

    const removeExercise = async (exercise: SupportExerciseRow) => {
        if (!canEdit(exercise.user_id)) return;
        if (!window.confirm(`Delete "${exercise.name}"? Sessions using it must be changed first.`)) return;

        try {
            await deleteSupportExercise(exercise.id);
            await loadLibrary();
            toast.success('Support exercise deleted.');
        } catch (err) {
            console.error('Failed to delete support exercise', err);
            toast.error('Could not delete exercise. Remove it from support sessions first.');
        }
    };

    const updateTemplateExercise = (index: number, patch: Partial<TemplateExerciseForm>) => {
        setTemplateForm((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                exercises: prev.exercises.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
            };
        });
    };

    const addTemplateExercise = () => {
        if (library.exercises.length === 0) {
            setTemplateFormError('Create an exercise before adding it to a support session.');
            return;
        }
        setTemplateFormError(null);
        setTemplateForm((prev) => prev
            ? {
                ...prev,
                exercises: [
                    ...prev.exercises,
                    {
                        exerciseId: library.exercises[0]?.id ?? '',
                        sets: '',
                        reps: '',
                        durationSeconds: '',
                        restSeconds: '',
                        loadPrescription: '',
                        side: '',
                        notes: '',
                    },
                ],
            }
            : prev);
    };

    const removeTemplateExercise = (index: number) => {
        setTemplateFormError(null);
        setTemplateForm((prev) => prev
            ? { ...prev, exercises: prev.exercises.filter((_, rowIndex) => rowIndex !== index) }
            : prev);
    };

    return (
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-content-muted">
                        <Dumbbell size={16} className="text-indigo-400" />
                        Support Library
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-content-primary">Support Work</h1>
                    <p className="mt-1 max-w-3xl text-sm text-content-muted">
                        Manage strength, core, mobility, stretching, prehab, and recovery sessions separately from rowing workout templates.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setExerciseForm(newExerciseForm())}>
                        Exercise
                    </Button>
                    <Button icon={<Plus size={16} />} onClick={() => setTemplateForm(newTemplateForm())}>
                        Session
                    </Button>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card>
                    <p className="text-xs text-content-muted">Standard sessions</p>
                    <p className="mt-1 text-2xl font-semibold text-content-primary">{library.sessionTemplates.length - personalTemplateCount}</p>
                </Card>
                <Card>
                    <p className="text-xs text-content-muted">My sessions</p>
                    <p className="mt-1 text-2xl font-semibold text-content-primary">{personalTemplateCount}</p>
                </Card>
                <Card>
                    <p className="text-xs text-content-muted">My exercises</p>
                    <p className="mt-1 text-2xl font-semibold text-content-primary">{personalExerciseCount}</p>
                </Card>
            </div>

            <Card className="mb-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex rounded-lg border border-border bg-surface-secondary p-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('sessions')}
                            aria-pressed={activeTab === 'sessions'}
                            className={`min-h-10 flex-1 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none ${activeTab === 'sessions' ? 'bg-surface-card text-content-primary shadow-sm' : 'text-content-muted hover:text-content-primary'}`}
                        >
                            Sessions
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('exercises')}
                            aria-pressed={activeTab === 'exercises'}
                            className={`min-h-10 flex-1 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none ${activeTab === 'exercises' ? 'bg-surface-card text-content-primary shadow-sm' : 'text-content-muted hover:text-content-primary'}`}
                        >
                            Exercises
                        </button>
                    </div>
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-faint" size={18} />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            aria-label="Search support work"
                            placeholder="Search support work..."
                            className="min-h-11 w-full rounded-lg border border-border bg-surface-secondary py-2 pl-10 pr-3 text-sm text-content-primary outline-none focus:border-accent-primary"
                        />
                    </div>
                    <select
                        value={kindFilter}
                        onChange={(event) => setKindFilter(event.target.value as 'all' | SupportKind)}
                        aria-label="Filter support work by type"
                        className="min-h-11 rounded-lg border border-border bg-surface-secondary px-3 text-sm text-content-primary outline-none focus:border-accent-primary"
                    >
                        <option value="all">All types</option>
                        {supportKinds.map((kind) => (
                            <option key={kind.value} value={kind.value}>{kind.label}</option>
                        ))}
                    </select>
                </div>
            </Card>

            {error && (
                <Card className="mb-6 border-red-500/40 bg-red-500/10">
                    <p className="flex items-start gap-2 text-sm text-red-300">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        {error}
                    </p>
                </Card>
            )}

            {loading ? (
                <Card>
                    <EmptyState title="Loading support work..." description="Fetching standard and personal support templates." />
                </Card>
            ) : activeTab === 'sessions' ? (
                filteredTemplates.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {filteredTemplates.map((template) => {
                            const editable = canEdit(template.user_id);
                            return (
                                <Card key={template.id}>
                                    <CardHeader
                                        title={template.title}
                                        subtitle={`${template.exercises.length} exercise${template.exercises.length === 1 ? '' : 's'}${template.estimated_duration_minutes ? ` · ${template.estimated_duration_minutes} min` : ''}`}
                                        action={
                                            <div className="flex flex-wrap justify-end gap-1.5">
                                                <Badge variant={template.user_id ? 'coaching' : 'success'}>{template.user_id ? 'Mine' : 'Standard'}</Badge>
                                                <Badge variant="muted">{supportKinds.find((kind) => kind.value === template.kind)?.label ?? template.kind}</Badge>
                                            </div>
                                        }
                                    />
                                    {template.description && (
                                        <p className="mb-3 text-sm text-content-muted">{template.description}</p>
                                    )}
                                    <div className="space-y-2">
                                        {template.exercises.map((row) => (
                                            <div key={row.id} className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm font-medium text-content-primary">{row.exercise?.name ?? 'Support exercise'}</p>
                                                    <span className="text-xs text-content-muted">#{row.sort_order}</span>
                                                </div>
                                                <p className="mt-1 text-xs text-content-muted">
                                                    {[row.sets ? `${row.sets} sets` : '', row.reps, row.duration_seconds ? `${row.duration_seconds}s` : '', row.load_prescription].filter(Boolean).join(' · ') || 'Prescription details optional'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            icon={<Copy size={14} />}
                                            onClick={() => setTemplateForm(cloneTemplateToForm(template))}
                                        >
                                            Duplicate
                                        </Button>
                                        {editable && (
                                            <>
                                                <Button type="button" variant="secondary" size="sm" icon={<Edit3 size={14} />} onClick={() => setTemplateForm(templateToForm(template))}>
                                                    Edit
                                                </Button>
                                                <Button type="button" variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => void removeTemplate(template)}>
                                                    Delete
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <Card>
                        <EmptyState
                            icon={<Layers3 size={28} />}
                            title="No support sessions found"
                            description="Create a session or clear the filters."
                            action={<Button icon={<Plus size={16} />} onClick={() => setTemplateForm(newTemplateForm())}>New session</Button>}
                        />
                    </Card>
                )
            ) : filteredExercises.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredExercises.map((exercise) => {
                        const editable = canEdit(exercise.user_id);
                        return (
                            <Card key={exercise.id}>
                                <CardHeader
                                    title={exercise.name}
                                    subtitle={[exercise.movement_pattern, exercise.default_sets ? `${exercise.default_sets} sets` : '', exercise.default_reps].filter(Boolean).join(' · ') || 'No default prescription'}
                                    action={<Badge variant={exercise.user_id ? 'coaching' : 'success'}>{exercise.user_id ? 'Mine' : 'Standard'}</Badge>}
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    <Badge variant="muted">{supportKinds.find((kind) => kind.value === exercise.category)?.label ?? exercise.category}</Badge>
                                    {exercise.equipment.slice(0, 3).map((item) => (
                                        <Badge key={item} variant="default">{item}</Badge>
                                    ))}
                                </div>
                                {exercise.cues.length > 0 && (
                                    <p className="mt-3 text-xs text-content-muted">{exercise.cues[0]}</p>
                                )}
                                {editable && (
                                    <div className="mt-4 flex justify-end gap-2">
                                        <Button type="button" variant="secondary" size="sm" icon={<Edit3 size={14} />} onClick={() => setExerciseForm(exerciseToForm(exercise))}>
                                            Edit
                                        </Button>
                                        <Button type="button" variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => void removeExercise(exercise)}>
                                            Delete
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card>
                    <EmptyState
                        icon={<Dumbbell size={28} />}
                        title="No exercises found"
                        description="Create an exercise or clear the filters."
                        action={<Button icon={<Plus size={16} />} onClick={() => setExerciseForm(newExerciseForm())}>New exercise</Button>}
                    />
                </Card>
            )}

            <div className="mt-6 text-sm text-content-muted">
                Training-block support checkoffs still live on the <Link to="/training-block" className="text-indigo-400 hover:text-indigo-300">Training Block</Link> page.
            </div>

            <Modal
                open={Boolean(exerciseForm)}
                onClose={() => setExerciseForm(null)}
                title={exerciseForm?.id ? 'Edit exercise' : 'New exercise'}
                description="Create reusable movement options for support sessions."
                placement="mobile-sheet"
                size="lg"
            >
                {exerciseForm && (
                    <form onSubmit={saveExercise} className="space-y-4">
                        <Input
                            label="Name"
                            value={exerciseForm.name}
                            onChange={(event) => {
                                setExerciseForm({ ...exerciseForm, name: event.target.value });
                                setExerciseFormError(null);
                            }}
                            error={exerciseFormError ?? undefined}
                            required
                        />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Select label="Category" value={exerciseForm.category} onChange={(event) => setExerciseForm({ ...exerciseForm, category: event.target.value as SupportKind })}>
                                {supportKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                            </Select>
                            <Input label="Movement pattern" value={exerciseForm.movementPattern} onChange={(event) => setExerciseForm({ ...exerciseForm, movementPattern: event.target.value })} placeholder="hinge, press, brace..." />
                        </div>
                        <Input label="Equipment" value={exerciseForm.equipment} onChange={(event) => setExerciseForm({ ...exerciseForm, equipment: event.target.value })} hint="Comma separated" />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <Input label="Default sets" inputMode="numeric" value={exerciseForm.defaultSets} onChange={(event) => setExerciseForm({ ...exerciseForm, defaultSets: event.target.value })} />
                            <Input label="Default reps" value={exerciseForm.defaultReps} onChange={(event) => setExerciseForm({ ...exerciseForm, defaultReps: event.target.value })} placeholder="8-10" />
                            <Input label="Duration seconds" inputMode="numeric" value={exerciseForm.defaultDurationSeconds} onChange={(event) => setExerciseForm({ ...exerciseForm, defaultDurationSeconds: event.target.value })} />
                        </div>
                        <label className="block text-xs font-medium text-content-muted">
                            Cues
                            <textarea value={exerciseForm.cues} onChange={(event) => setExerciseForm({ ...exerciseForm, cues: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-content-primary outline-none focus:border-accent-primary" />
                        </label>
                        <Input label="Tags" value={exerciseForm.tags} onChange={(event) => setExerciseForm({ ...exerciseForm, tags: event.target.value })} hint="Comma separated" />
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button type="button" variant="secondary" onClick={() => setExerciseForm(null)}>Cancel</Button>
                            <Button type="submit" loading={saving}>Save exercise</Button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal
                open={Boolean(templateForm)}
                onClose={() => setTemplateForm(null)}
                title={templateForm?.id ? 'Edit support session' : 'New support session'}
                description="Build a reusable support prescription from exercises."
                placement="mobile-sheet"
                size="full"
            >
                {templateForm && (
                    <form onSubmit={saveTemplate} className="space-y-5">
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <Input
                                label="Title"
                                value={templateForm.title}
                                onChange={(event) => {
                                    setTemplateForm({ ...templateForm, title: event.target.value });
                                    setTemplateFormError(null);
                                }}
                                error={templateFormError === 'Session title is required.' ? templateFormError : undefined}
                                required
                            />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <Select label="Kind" value={templateForm.kind} onChange={(event) => setTemplateForm({ ...templateForm, kind: event.target.value as SupportKind })}>
                                    {supportKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                                </Select>
                                <Select label="Difficulty" value={templateForm.difficulty} onChange={(event) => setTemplateForm({ ...templateForm, difficulty: event.target.value as TemplateFormState['difficulty'] })}>
                                    <option value="">None</option>
                                    {difficulties.map((difficulty) => <option key={difficulty.value} value={difficulty.value}>{difficulty.label}</option>)}
                                </Select>
                                <Input label="Minutes" inputMode="numeric" value={templateForm.estimatedDurationMinutes} onChange={(event) => setTemplateForm({ ...templateForm, estimatedDurationMinutes: event.target.value })} />
                            </div>
                        </div>
                        <Input label="Description" value={templateForm.description} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} />
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <Input label="Focus" value={templateForm.focus} onChange={(event) => setTemplateForm({ ...templateForm, focus: event.target.value })} hint="Comma separated" />
                            <label className="block text-xs font-medium text-content-muted">
                                Instructions
                                <textarea value={templateForm.instructions} onChange={(event) => setTemplateForm({ ...templateForm, instructions: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-content-primary outline-none focus:border-accent-primary" />
                            </label>
                        </div>

                        <section className="rounded-xl border border-border bg-surface-secondary p-3 sm:p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-content-primary">Exercises</h3>
                                    <p className="text-xs text-content-muted">Order matters. Use notes for movement-specific guidance.</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    icon={<Plus size={14} />}
                                    onClick={addTemplateExercise}
                                    title={library.exercises.length === 0 ? 'Create an exercise first' : undefined}
                                >
                                    Add
                                </Button>
                            </div>
                            {templateFormError && templateFormError !== 'Session title is required.' && (
                                <p className="mb-3 text-xs text-red-400">{templateFormError}</p>
                            )}
                            {templateForm.exercises.length === 0 ? (
                                <EmptyState
                                    title="No exercises added"
                                    description={library.exercises.length === 0 ? 'Create an exercise first, then add it to this session.' : 'Add at least one exercise to save the session.'}
                                    action={library.exercises.length === 0 ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            icon={<Plus size={16} />}
                                            onClick={() => {
                                                setTemplateForm(null);
                                                setTemplateFormError(null);
                                                setExerciseForm(newExerciseForm());
                                            }}
                                        >
                                            New exercise
                                        </Button>
                                    ) : undefined}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {templateForm.exercises.map((row, index) => (
                                        <div key={`${index}-${row.exerciseId}`} className="rounded-lg border border-border bg-surface-card p-3">
                                            <div className="mb-3 flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold uppercase text-content-muted">Exercise {index + 1}</span>
                                                <button type="button" onClick={() => removeTemplateExercise(index)} className="rounded-md p-2 text-content-muted hover:bg-surface-secondary hover:text-red-400" aria-label="Remove exercise">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
                                                <Select label="Exercise" value={row.exerciseId} onChange={(event) => updateTemplateExercise(index, { exerciseId: event.target.value })}>
                                                    <option value="">Choose exercise</option>
                                                    {library.exercises.map((exercise) => (
                                                        <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
                                                    ))}
                                                </Select>
                                                <Input label="Sets" inputMode="numeric" value={row.sets} onChange={(event) => updateTemplateExercise(index, { sets: event.target.value })} />
                                                <Input label="Reps" value={row.reps} onChange={(event) => updateTemplateExercise(index, { reps: event.target.value })} />
                                                <Input label="Work sec" inputMode="numeric" value={row.durationSeconds} onChange={(event) => updateTemplateExercise(index, { durationSeconds: event.target.value })} />
                                                <Input label="Rest sec" inputMode="numeric" value={row.restSeconds} onChange={(event) => updateTemplateExercise(index, { restSeconds: event.target.value })} />
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                                                <Input label="Load" value={row.loadPrescription} onChange={(event) => updateTemplateExercise(index, { loadPrescription: event.target.value })} placeholder="RPE 7, light, bodyweight..." />
                                                <Select label="Side" value={row.side} onChange={(event) => updateTemplateExercise(index, { side: event.target.value as TemplateExerciseForm['side'] })}>
                                                    <option value="">None</option>
                                                    <option value="both">Both</option>
                                                    <option value="left">Left</option>
                                                    <option value="right">Right</option>
                                                    <option value="alternating">Alternating</option>
                                                    <option value="per_side">Per side</option>
                                                </Select>
                                                <Input label="Notes" value={row.notes} onChange={(event) => updateTemplateExercise(index, { notes: event.target.value })} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button type="button" variant="secondary" onClick={() => setTemplateForm(null)}>Cancel</Button>
                            <Button type="submit" loading={saving}>Save session</Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};
