import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Library, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import {
    fetchTemplateProposals,
    promoteTemplateProposal,
    updateTemplateProposalStatus,
} from '../services/templateProposalService';
import type { WorkoutTemplateProposal } from '../types/workoutStructure.types';

const ACTIVE_STATUSES = ['pending', 'under_review'] as const;

export const TemplateProposalReview: React.FC = () => {
    const { isAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [proposals, setProposals] = useState<WorkoutTemplateProposal[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

    const loadProposals = async () => {
        setLoading(true);
        try {
            const all = await fetchTemplateProposals();
            setProposals(all.filter(proposal => ACTIVE_STATUSES.includes(proposal.status as typeof ACTIVE_STATUSES[number])));
        } catch (error) {
            console.error('Failed to load template proposals:', error);
            toast.error('Failed to load workout proposals.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            loadProposals();
        }
    }, [isAdmin]);

    const handleReviewAction = async (
        proposal: WorkoutTemplateProposal,
        action: 'under_review' | 'reject' | 'promote_community' | 'promote_standard'
    ) => {
        setBusyId(proposal.id);
        try {
            if (action === 'under_review') {
                await updateTemplateProposalStatus(proposal.id, {
                    status: 'under_review',
                    review_notes: reviewNotes[proposal.id]?.trim() || null,
                    reviewed: true,
                });
            } else if (action === 'reject') {
                await updateTemplateProposalStatus(proposal.id, {
                    status: 'rejected',
                    review_notes: reviewNotes[proposal.id]?.trim() || null,
                    reviewed: true,
                });
            } else {
                await promoteTemplateProposal(
                    proposal,
                    action === 'promote_standard' ? 'standard' : 'community',
                    reviewNotes[proposal.id]?.trim() || undefined
                );
            }

            await loadProposals();
            toast.success('Proposal updated.');
        } catch (error) {
            console.error('Failed to update proposal:', error);
            toast.error('Failed to update proposal. Please try again.');
        } finally {
            setBusyId(null);
        }
    };

    if (!isAdmin) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
                    <h1 className="text-2xl font-bold text-white">Proposal review is admin-only</h1>
                    <p className="mt-2 text-neutral-400">
                        You can still browse the public library or submit a workout proposal.
                    </p>
                    <div className="mt-6 flex justify-center gap-3">
                        <Link to="/library" className="rounded-lg bg-neutral-800 px-4 py-2 text-white hover:bg-neutral-700">
                            Back to library
                        </Link>
                        <Link to="/library/propose" className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">
                            Propose workout
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Workout proposal review</h1>
                    <p className="mt-2 text-neutral-400">
                        Promote strong submissions into the community library or the validated standard library.
                    </p>
                </div>
                <Link to="/library" className="rounded-lg bg-neutral-800 px-4 py-2 text-white hover:bg-neutral-700">
                    Back to library
                </Link>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-12 text-center text-neutral-500">
                    Loading proposals...
                </div>
            ) : proposals.length === 0 ? (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-12 text-center text-neutral-500">
                    No active proposals to review.
                </div>
            ) : (
                <div className="space-y-4">
                    {proposals.map((proposal) => (
                        <div key={proposal.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-xl font-semibold text-white">{proposal.name}</h2>
                                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                                            {proposal.status === 'under_review' ? 'Under review' : 'Pending'}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-neutral-300">{proposal.description}</p>
                                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-400">
                                        <span>Submitted {new Date(proposal.created_at).toLocaleString()}</span>
                                        {proposal.attribution_name && <span>By {proposal.attribution_name}</span>}
                                        {proposal.training_zone && <span>{proposal.training_zone}</span>}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm text-emerald-300">
                                    {proposal.rwn}
                                </div>
                            </div>

                            {proposal.notes && (
                                <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-300">
                                    {proposal.notes}
                                </div>
                            )}

                            <textarea
                                value={reviewNotes[proposal.id] ?? proposal.review_notes ?? ''}
                                onChange={(event) => setReviewNotes((current) => ({
                                    ...current,
                                    [proposal.id]: event.target.value,
                                }))}
                                rows={3}
                                placeholder="Optional reviewer notes"
                                className="mt-4 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                            />

                            <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    disabled={busyId === proposal.id}
                                    onClick={() => handleReviewAction(proposal, 'under_review')}
                                    className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-white hover:bg-neutral-700 disabled:opacity-50"
                                >
                                    <Eye size={16} />
                                    Mark under review
                                </button>
                                <button
                                    type="button"
                                    disabled={busyId === proposal.id}
                                    onClick={() => handleReviewAction(proposal, 'promote_community')}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
                                >
                                    <Library size={16} />
                                    Promote to community
                                </button>
                                <button
                                    type="button"
                                    disabled={busyId === proposal.id}
                                    onClick={() => handleReviewAction(proposal, 'promote_standard')}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    <ShieldCheck size={16} />
                                    Promote to standard
                                </button>
                                <button
                                    type="button"
                                    disabled={busyId === proposal.id}
                                    onClick={() => handleReviewAction(proposal, 'reject')}
                                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
                                >
                                    <XCircle size={16} />
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
