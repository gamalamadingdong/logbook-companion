import { useEffect, useState } from 'react';
import { loadWorkoutPaceRank, type PaceRankRequest, type WorkoutPaceRank } from '../services/workoutPaceRankService';

function ordinal(value: number): string {
    const lastTwo = value % 100;
    const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th');
    return `${value}${suffix}`;
}

function rankLabel({ rank, tied, attemptCount }: WorkoutPaceRank): string {
    if (attemptCount === 1) return 'First recorded attempt';
    if (rank === 1) return tied ? `Tied for best of ${attemptCount} attempts` : `Best of ${attemptCount} attempts`;
    return `${tied ? 'Tied for ' : ''}${ordinal(rank)} of ${attemptCount} attempts`;
}

export function WorkoutPaceHistory({ userId, workoutId, workPace, mainIndices }: Omit<PaceRankRequest, 'signal'>) {
    const [rank, setRank] = useState<WorkoutPaceRank | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        void loadWorkoutPaceRank({ userId, workoutId, workPace, mainIndices, signal: controller.signal })
            .then(result => {
                if (!controller.signal.aborted) setRank(result);
            })
            .catch(() => {
                if (!controller.signal.aborted) setRank(null);
            });
        return () => controller.abort();
    }, [userId, workoutId, workPace, mainIndices]);

    if (!rank) return null;

    const percentile = rank.rank > 1 ? rank.percentile : null;
    return (
        <aside
            aria-label="Work pace vs. your history"
            className="flex flex-col gap-x-4 gap-y-2 rounded-xl border border-border-subtle bg-surface-card px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-baseline"
        >
            <span className="font-medium text-content-secondary">Work pace vs. your history</span>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
                {percentile !== null && <strong className="text-content-primary">{ordinal(percentile)} percentile</strong>}
                <span className={percentile !== null ? 'text-content-secondary' : 'font-semibold text-content-primary'}>
                    {rankLabel(rank)}
                </span>
                {rank.secondsOffBest > 0 && (
                    <span className="text-content-muted">{rank.secondsOffBest.toFixed(1)} s/500m off your best</span>
                )}
            </div>
        </aside>
    );
}
