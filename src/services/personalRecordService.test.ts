import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    upsert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    from: vi.fn(),
    detectPersonalRecord: vi.fn(),
}))

vi.mock('./supabase', () => ({
    supabase: {
        auth: { getUser: mocks.getUser },
        from: mocks.from,
    },
}))

vi.mock('../utils/personalRecords', () => ({ detectPersonalRecord: mocks.detectPersonalRecord }))

import { getPersonalRecords, persistPersonalRecord, type PersonalRecordRow } from './personalRecordService'

type ComparableWorkout = { watts: number }

const baseInput = {
    history: [{ watts: 300 }],
    candidate: { watts: 320 },
    metricSelector: (workout: ComparableWorkout) => workout.watts,
    direction: 'higher-is-better' as const,
    activity: 'rowing',
    metric: 'watts',
    workoutId: 'workout-123',
    achievedAt: new Date().toISOString(),
}

describe('persistPersonalRecord', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getUser.mockResolvedValue({ data: { user: { id: 'authenticated-user' } }, error: null })
        mocks.from.mockReturnValue({ upsert: mocks.upsert })
        mocks.upsert.mockResolvedValue({ error: null })
    })

    it('upserts a strict personal record for the authenticated user', async () => {
        mocks.detectPersonalRecord.mockReturnValue({ isRecord: true, priorBest: 300, delta: 20 })

        await persistPersonalRecord(baseInput)

        expect(mocks.detectPersonalRecord).toHaveBeenCalledWith(
            baseInput.history,
            baseInput.candidate,
            baseInput.metricSelector,
            baseInput.direction,
        )
        expect(mocks.from).toHaveBeenCalledWith('personal_records')
        expect(mocks.upsert).toHaveBeenCalledWith(
            {
                user_id: 'authenticated-user',
                activity: 'rowing',
                metric: 'watts',
                best_value: 320,
                workout_id: 'workout-123',
                achieved_at: baseInput.achievedAt,
            },
            { onConflict: 'user_id,activity,metric' },
        )
    })

    it('does not construct a database write for a non-record', async () => {
        mocks.detectPersonalRecord.mockReturnValue({ isRecord: false, priorBest: 320, delta: 0 })

        await persistPersonalRecord({ ...baseInput, candidate: { watts: 320 } })

        expect(mocks.from).not.toHaveBeenCalled()
        expect(mocks.upsert).not.toHaveBeenCalled()
    })

    it('uses the strict conflict key on an idempotent rerun', async () => {
        mocks.detectPersonalRecord.mockReturnValue({ isRecord: true, priorBest: 300, delta: 20 })

        await persistPersonalRecord(baseInput)
        await persistPersonalRecord(baseInput)

        expect(mocks.upsert).toHaveBeenCalledTimes(2)
        expect(mocks.upsert).toHaveBeenNthCalledWith(
            2,
            expect.any(Object),
            { onConflict: 'user_id,activity,metric' },
        )
    })

    it('derives the persisted owner from Supabase authentication', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: { id: 'other-authenticated-user' } }, error: null })
        mocks.detectPersonalRecord.mockReturnValue({ isRecord: true, priorBest: 300, delta: 20 })

        await persistPersonalRecord(baseInput)

        expect(mocks.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: 'other-authenticated-user' }),
            expect.any(Object),
        )
    })

    it('fails clearly when there is no authenticated user', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })

        await expect(persistPersonalRecord(baseInput)).rejects.toThrow('authenticated user')

        expect(mocks.detectPersonalRecord).not.toHaveBeenCalled()
        expect(mocks.from).not.toHaveBeenCalled()
    })
})

describe('getPersonalRecords', () => {
    const records: PersonalRecordRow[] = [
        {
            id: 'record-123',
            user_id: 'user-123',
            activity: 'rowing',
            metric: 'watts',
            best_value: 320,
            workout_id: 'workout-123',
            achieved_at: '2025-01-01T00:00:00.000Z',
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z',
        },
    ]

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.from.mockReturnValue({ select: mocks.select })
        mocks.select.mockReturnValue({ eq: mocks.eq })
        mocks.eq.mockResolvedValue({ data: records, error: null })
    })

    it('reads the current records for the supplied owner', async () => {
        await expect(getPersonalRecords('user-123')).resolves.toEqual(records)

        expect(mocks.from).toHaveBeenCalledWith('personal_records')
        expect(mocks.select).toHaveBeenCalledWith('*')
        expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-123')
    })

    it('propagates a Supabase read error', async () => {
        const readError = new Error('Unable to read records')
        mocks.eq.mockResolvedValue({ data: null, error: readError })

        await expect(getPersonalRecords('user-123')).rejects.toBe(readError)
    })
})
