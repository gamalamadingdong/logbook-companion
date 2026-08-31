import type { Database } from '../types/database.types'
import {
    detectPersonalRecord,
    type MetricDirection,
    type PersonalRecordResult,
} from '../utils/personalRecords'
import { supabase } from './supabase'

type PersonalRecordInsert = Database['public']['Tables']['personal_records']['Insert']

export type PersistPersonalRecordInput<T> = {
    history: readonly T[]
    candidate: T
    metricSelector: (item: T) => number
    direction: MetricDirection
    activity: string
    metric: string
    workoutId: string | null
    achievedAt: string
}

export async function persistPersonalRecord<T>(
    input: PersistPersonalRecordInput<T>,
): Promise<PersonalRecordResult> {
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError) {
        throw authError
    }

    if (!authData.user) {
        throw new Error('Cannot persist a personal record without an authenticated user.')
    }

    const recordResult = detectPersonalRecord(
        input.history,
        input.candidate,
        input.metricSelector,
        input.direction,
    )

    if (!recordResult.isRecord) {
        return recordResult
    }

    const personalRecord: PersonalRecordInsert = {
        user_id: authData.user.id,
        activity: input.activity,
        metric: input.metric,
        best_value: input.metricSelector(input.candidate),
        workout_id: input.workoutId,
        achieved_at: input.achievedAt,
    }

    const { error } = await supabase
        .from('personal_records')
        .upsert(personalRecord, { onConflict: 'user_id,activity,metric' })

    if (error) {
        throw error
    }

    return recordResult
}
