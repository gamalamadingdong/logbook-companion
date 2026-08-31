import { describe, expect, it } from 'vitest'

import { detectPersonalRecord } from './personalRecords'

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
