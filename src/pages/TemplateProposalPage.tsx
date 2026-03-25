import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { createTemplateProposal } from '../services/templateProposalService';
import { findDuplicateTemplate } from '../services/templateService';
import { estimateDuration, formatDuration, parseRWN, validateRWN } from '../utils/rwnParser';

const TRAINING_ZONES = ['UT2', 'UT1', 'AT', 'TR', 'AN'] as const;

export const TemplateProposalPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [trainingZone, setTrainingZone] = useState('');
    const [difficultyLevel, setDifficultyLevel] = useState('intermediate');
    const [rwn, setRwn] = useState('');
    const [notes, setNotes] = useState('');
    const [attributionName, setAttributionName] = useState('');
    const [attributionContact, setAttributionContact] = useState('');

    const validation = useMemo(() => {
        if (!rwn.trim()) return null;
        return validateRWN(rwn);
    }, [rwn]);

    const estimate = useMemo(() => {
        if (!rwn.trim()) return null;
        return estimateDuration(rwn);
    }, [rwn]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!rwn.trim()) {
            toast.error('Please provide an RWN workout description.');
            return;
        }

        if (!validation?.valid) {
            toast.error(validation?.errors?.join('; ') || 'Please fix the RWN before submitting.');
            return;
        }

        setSubmitting(true);

        try {
            const structure = parseRWN(rwn);
            if (!structure) {
                toast.error('Unable to parse the RWN into a workout structure.');
                return;
            }

            const duplicate = await findDuplicateTemplate(structure);

            if (duplicate) {
                toast.error(`This looks like "${duplicate.name}" in the library already.`);
                navigate(`/library/${duplicate.id}`);
                return;
            }

            await createTemplateProposal({
                name: name.trim() || rwn.trim(),
                description: description.trim() || 'Community-submitted workout proposal',
                workout_type: 'erg',
                training_zone: trainingZone ? trainingZone as 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN' : null,
                difficulty_level: difficultyLevel,
                rwn: rwn.trim(),
                workout_structure: structure,
                notes: notes.trim() || undefined,
                attribution_name: attributionName.trim() || (user?.email ?? undefined),
                attribution_contact: attributionContact.trim() || undefined,
            });

            toast.success('Workout proposal submitted for review.');
            navigate('/library');
        } catch (error) {
            console.error('Failed to submit workout proposal:', error);
            toast.error('Failed to submit workout proposal. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <button
                type="button"
                onClick={() => navigate('/library')}
                className="mb-6 inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
            >
                <ArrowLeft size={16} />
                Back to library
            </button>

            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 md:p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white">Propose a workout</h1>
                    <p className="text-neutral-400 mt-2">
                        Submit an RWN-based workout for the community library. Approved submissions can be promoted into the public community layer or the curated standard library.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                            <span className="text-sm font-medium text-neutral-300">Workout name</span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Optional — defaults to the RWN text"
                                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-neutral-300">Training zone</span>
                            <select
                                value={trainingZone}
                                onChange={(e) => setTrainingZone(e.target.value)}
                                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                            >
                                <option value="">Unspecified</option>
                                {TRAINING_ZONES.map(zone => (
                                    <option key={zone} value={zone}>{zone}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-sm font-medium text-neutral-300">Description</span>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="What is the intent of this workout? Who is it for?"
                            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        />
                    </label>

                    <div className="grid gap-4 md:grid-cols-[1fr,220px]">
                        <label className="block">
                            <span className="text-sm font-medium text-neutral-300">RWN</span>
                            <textarea
                                value={rwn}
                                onChange={(e) => setRwn(e.target.value)}
                                rows={4}
                                placeholder="Example: 4x1500m/4:00r@2k+6"
                                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 font-mono text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-neutral-300">Difficulty</span>
                            <select
                                value={difficultyLevel}
                                onChange={(e) => setDifficultyLevel(e.target.value)}
                                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                            >
                                <option value="novice">Novice</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                                <option value="elite">Elite</option>
                            </select>
                        </label>
                    </div>

                    {validation && (
                        <div className={`rounded-xl border p-4 ${validation.valid ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-red-700/50 bg-red-950/30'}`}>
                            <div className="text-sm font-medium text-white">
                                {validation.valid ? 'RWN looks valid.' : 'Please fix the RWN before submitting.'}
                            </div>
                            {validation.valid && estimate && estimate.totalTime > 0 && (
                                <div className="mt-2 text-sm text-emerald-300">
                                    Estimated duration: {formatDuration(estimate.totalTime)}
                                </div>
                            )}
                            {!validation.valid && validation.errors.length > 0 && (
                                <ul className="mt-2 space-y-1 text-sm text-red-200">
                                    {validation.errors.map((error, index) => (
                                        <li key={`${error}-${index}`}>{error}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <label className="block">
                        <span className="text-sm font-medium text-neutral-300">Reviewer notes</span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Optional context for reviewers: target athlete level, why this matters, or how you use it."
                            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                        />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                            <span className="text-sm font-medium text-neutral-300">Attribution name</span>
                            <input
                                value={attributionName}
                                onChange={(e) => setAttributionName(e.target.value)}
                                placeholder="Optional public credit"
                                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-neutral-300">Contact</span>
                            <input
                                value={attributionContact}
                                onChange={(e) => setAttributionContact(e.target.value)}
                                placeholder="Optional email or handle for follow-up"
                                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-6">
                        <p className="text-sm text-neutral-500">
                            Submissions start in a moderation queue before they enter the public library.
                        </p>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-800"
                        >
                            <Send size={16} />
                            {submitting ? 'Submitting...' : 'Submit proposal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
