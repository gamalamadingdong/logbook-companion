import { describe, expect, it } from 'vitest'

import { detectPersonalRecord, isPersonalRecord } from './personalRecords'

type Workout = {
    score: number
}

const score = (workout: Workout) => workout.score

describe('detectPersonalRecord', () => {
    it('recognizes the first candidate when history is empty', () => {
        expect(detectPersonalRecord([], { score: 100 }, score, 'higher-is-better')).toEqual({
            isRecord: true,
            priorBest: null,
            delta: null,
        })
    })

    it('recognizes a strict improvement for a higher-is-better metric', () => {
        expect(
            detectPersonalRecord(
                [{ score: 100 }, { score: 110 }],
                { score: 125 },
                score,
                'higher-is-better',
            ),
        ).toEqual({ isRecord: true, priorBest: 110, delta: 15 })
    })

    it('does not recognize a tie as a record', () => {
        expect(
            detectPersonalRecord([{ score: 100 }, { score: 110 }], { score: 110 }, score, 'higher-is-better'),
        ).toEqual({ isRecord: false, priorBest: 110, delta: 0 })
    })

    it('does not recognize a worse candidate than the historical best', () => {
        expect(
            detectPersonalRecord([{ score: 100 }, { score: 110 }], { score: 105 }, score, 'higher-is-better'),
        ).toEqual({ isRecord: false, priorBest: 110, delta: -5 })
    })

    it('uses the minimum and normalizes improvement for a lower-is-better metric', () => {
        expect(
            detectPersonalRecord(
                [{ score: 420 }, { score: 405 }],
                { score: 390 },
                score,
                'lower-is-better',
            ),
        ).toEqual({ isRecord: true, priorBest: 405, delta: 15 })
    })

    it('reports a tie and a worse result correctly for a lower-is-better metric', () => {
        expect(
            detectPersonalRecord([{ score: 420 }, { score: 405 }], { score: 405 }, score, 'lower-is-better'),
        ).toEqual({ isRecord: false, priorBest: 405, delta: 0 })

        expect(
            detectPersonalRecord([{ score: 420 }, { score: 405 }], { score: 410 }, score, 'lower-is-better'),
        ).toEqual({ isRecord: false, priorBest: 405, delta: -5 })
    })
})

describe('isPersonalRecord', () => {
    const records = [
        { activity: 'rowing', metric: 'watts', workout_id: 'workout-123' },
    ]

    it('recognizes the workout stored as the current record', () => {
        expect(
            isPersonalRecord(
                { id: 'workout-123', activity: 'rowing', metric: 'watts' },
                records,
            ),
        ).toBe(true)
    })

    it('does not recognize another workout in the same activity and metric', () => {
        expect(
            isPersonalRecord(
                { id: 'workout-456', activity: 'rowing', metric: 'watts' },
                records,
            ),
        ).toBe(false)
    })

    it('does not recognize a record from a different activity or metric', () => {
        expect(
            isPersonalRecord(
                { id: 'workout-123', activity: 'cycling', metric: 'watts' },
                records,
            ),
        ).toBe(false)
        expect(
            isPersonalRecord(
                { id: 'workout-123', activity: 'rowing', metric: 'distance' },
                records,
            ),
        ).toBe(false)
    })
})
