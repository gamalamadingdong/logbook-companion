export type MetricDirection = 'higher-is-better' | 'lower-is-better'

/**
 * The result of comparing a candidate metric with the best comparable history.
 *
 * For an empty history, `priorBest` and `delta` are `null` because there is no
 * baseline. Otherwise, `delta` is direction-normalized: positive means the
 * candidate improved on the prior best, zero means a tie, and negative means
 * the candidate was worse.
 */
export type PersonalRecordResult = {
    isRecord: boolean
    priorBest: number | null
    delta: number | null
}

export function detectPersonalRecord<T>(
    history: readonly T[],
    candidate: T,
    metricSelector: (item: T) => number,
    direction: MetricDirection,
): PersonalRecordResult {
    if (history.length === 0) {
        return { isRecord: true, priorBest: null, delta: null }
    }

    let priorBest = metricSelector(history[0])

    for (let index = 1; index < history.length; index += 1) {
        const historicalMetric = metricSelector(history[index])
        const isBetter =
            direction === 'higher-is-better'
                ? historicalMetric > priorBest
                : historicalMetric < priorBest

        if (isBetter) {
            priorBest = historicalMetric
        }
    }

    const candidateMetric = metricSelector(candidate)
    const delta =
        direction === 'higher-is-better'
            ? candidateMetric - priorBest
            : priorBest - candidateMetric

    return {
        isRecord: delta > 0,
        priorBest,
        delta,
    }
}
