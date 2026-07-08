import { useEffect, useState } from 'react';

import { getTrainingBlockMatchingContext } from '../services/trainingBlockService';
import type { TrainingBlockPlan } from '../types/trainingBlock.types';
import type { TrainingBlockMatchingContext } from '../utils/trainingBlockMatching';

export interface UseTrainingBlockMatchingContextResult {
    matchingContext: TrainingBlockMatchingContext;
    isLoading: boolean;
    error: Error | null;
}

export function useTrainingBlockMatchingContext(
    plan: TrainingBlockPlan | null,
): UseTrainingBlockMatchingContextResult {
    const [matchingContext, setMatchingContext] = useState<TrainingBlockMatchingContext>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!plan) {
            setMatchingContext({});
            setIsLoading(false);
            setError(null);
            return undefined;
        }

        setIsLoading(true);
        setError(null);

        void getTrainingBlockMatchingContext(plan)
            .then((nextContext) => {
                if (cancelled) return;
                setMatchingContext(nextContext);
            })
            .catch((matchError) => {
                if (cancelled) return;
                setMatchingContext({});
                setError(matchError instanceof Error
                    ? matchError
                    : new Error('Failed to load training block matching context'),
                );
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [plan]);

    return {
        matchingContext,
        isLoading,
        error,
    };
}
