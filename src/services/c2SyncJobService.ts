import { supabase } from './supabase'

export type C2SyncJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

export interface StartC2SyncJobOptions {
    requestedFrom?: string | null
    requestedTo?: string | null
    mode?: 'summary_only'
    metadata?: Record<string, unknown>
}

export interface C2SyncJob {
    id: string
    user_id: string
    status: C2SyncJobStatus
    source: 'concept2'
    requested_from: string | null
    requested_to: string | null
    started_at: string | null
    finished_at: string | null
    last_processed_at: string | null
    attempt_count: number
    error_code: string | null
    error_message: string | null
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
}

interface StartC2SyncResponse {
    job_id: string
    status: C2SyncJobStatus
    created_at: string
}

export async function startC2SyncJob(options: StartC2SyncJobOptions = {}) {
    const { data, error } = await supabase.functions.invoke<StartC2SyncResponse>('start-c2-sync', {
        body: {
            requested_from: options.requestedFrom ?? null,
            requested_to: options.requestedTo ?? null,
            mode: options.mode ?? 'summary_only',
            metadata: options.metadata ?? {},
        },
    })

    if (error) {
        throw error
    }

    if (!data) {
        throw new Error('Failed to start Concept2 sync job.')
    }

    return data
}

export async function getC2SyncJob(jobId: string) {
    const { data, error } = await supabase
        .from('c2_sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

    if (error) {
        throw error
    }

    return data as C2SyncJob
}
