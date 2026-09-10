// ChatGPT MCP connector for Logbook Companion (read-only training data).
//
// Transport: stateless Streamable HTTP (no session store, no Redis) — one
// McpServer + transport per request. This is the shape ChatGPT Developer Mode
// custom connectors expect over HTTPS.
//
// Auth: a single shared bearer token (MCP_BEARER_TOKEN). In the ChatGPT
// connector UI choose "OAuth" and paste this token as the static access token;
// ChatGPT sends it as `Authorization: Bearer <token>`. "No authentication" also
// works for local testing. Everything is hard-scoped to LOGBOOK_USER_ID.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
    readConfig,
    searchWorkouts,
    getWorkoutDetail,
    getTrainingSummary,
    getBenchmarkHistory,
    getWeeklyTrend,
    compareTrainingPeriods,
    listBenchmarks,
    type LogbookConfig,
} from './_lib/logbook.js';

export const config = { runtime: 'nodejs' };

function json(data: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

const dateSchema = z
    .string()
    .describe('ISO 8601 date or datetime, e.g. "2026-01-15" or "2026-01-15T00:00:00Z"');

function buildServer(cfg: LogbookConfig): McpServer {
    const server = new McpServer(
        { name: 'logbook-companion', version: '0.1.0' },
        {
            instructions:
                'Read-only access to a single athlete\'s rowing and cross-training history from ' +
                'Logbook Companion. Distances are meters, durations are seconds, pace (avg_split_500m) ' +
                'is seconds per 500m, watts is average power. Use search_workouts to find sessions, ' +
                'get_training_summary for rollups, compare_training_periods to contrast two windows, ' +
                'and get_benchmark_history for named efforts like "2000m".',
        },
    );

    server.tool(
        'search_workouts',
        'Search the athlete\'s workout history with optional filters. Returns individual sessions ' +
            '(rowing and cross-training) newest-first by default.',
        {
            startDate: dateSchema.optional(),
            endDate: dateSchema.optional(),
            workoutType: z.string().optional().describe('e.g. "rower", "cross_training", "strength". Call get_training_summary first to see which types exist.'),
            trainingZone: z.string().optional().describe('e.g. "UT2", "UT1", "AT", "TR", "AN" (often unset on logged sessions)'),
            source: z.enum(['concept2', 'erg_link_live', 'manual']).optional(),
            nameContains: z.string().optional().describe('Substring match against canonical_name, e.g. "1500"'),
            minDistanceMeters: z.number().optional(),
            maxDistanceMeters: z.number().optional(),
            minDurationSeconds: z.number().optional(),
            maxDurationSeconds: z.number().optional(),
            order: z.enum(['newest', 'oldest']).optional(),
            limit: z.number().int().min(1).max(500).optional(),
        },
        async (args) => json(await searchWorkouts(cfg, args)),
    );

    server.tool(
        'get_workout',
        'Get full detail for one workout by its id (UUID) or Concept2 external_id, including interval structure when present.',
        { id: z.string().describe('Workout UUID or Concept2 external_id') },
        async ({ id }) => {
            const detail = await getWorkoutDetail(cfg, id);
            return detail ? json(detail) : json({ error: 'Workout not found', id });
        },
    );

    server.tool(
        'get_training_summary',
        'Aggregate training over a date range: session count, total distance/duration/calories, ' +
            'average HR, and breakdowns by workout type, training zone, and source.',
        {
            startDate: dateSchema.optional(),
            endDate: dateSchema.optional(),
            workoutType: z.string().optional(),
        },
        async ({ startDate, endDate, workoutType }) =>
            json(await getTrainingSummary(cfg, startDate, endDate, workoutType)),
    );

    server.tool(
        'get_performance_trend',
        'Weekly training trend over a range: sessions, distance, duration, avg watts, avg HR per ISO week.',
        {
            startDate: dateSchema.optional(),
            endDate: dateSchema.optional(),
            workoutType: z.string().optional(),
        },
        async ({ startDate, endDate, workoutType }) =>
            json(await getWeeklyTrend(cfg, startDate, endDate, workoutType)),
    );

    server.tool(
        'compare_training_periods',
        'Compare two date windows (A vs B) and return a summary of each plus deltas. Useful for ' +
            'questions like "compare the 8 weeks before my best 2k with my last 8 weeks".',
        {
            periodAStart: dateSchema,
            periodAEnd: dateSchema,
            periodBStart: dateSchema,
            periodBEnd: dateSchema,
            workoutType: z.string().optional(),
        },
        async ({ periodAStart, periodAEnd, periodBStart, periodBEnd, workoutType }) =>
            json(
                await compareTrainingPeriods(
                    cfg,
                    { start: periodAStart, end: periodAEnd },
                    { start: periodBStart, end: periodBEnd },
                    workoutType,
                ),
            ),
    );

    server.tool(
        'get_benchmark_history',
        'History of a named benchmark effort identified by canonical name, e.g. "2000m", "5000m", "6000m", "30:00". ' +
            'Returns each attempt with date, pace, watts, and HR, newest first.',
        {
            benchmark: z.string().describe('Canonical workout name, e.g. "2000m" or "30:00"'),
            limit: z.number().int().min(1).max(200).optional(),
        },
        async ({ benchmark, limit }) => json(await getBenchmarkHistory(cfg, benchmark, limit ?? 50)),
    );

    server.tool(
        'list_benchmarks',
        'List the distinct benchmark/workout canonical names the athlete has logged, with attempt counts. ' +
            'Use this to discover what benchmarks exist before calling get_benchmark_history.',
        {},
        async () => json(await listBenchmarks(cfg)),
    );

    return server;
}

function sendError(res: VercelResponse, status: number, code: number, message: string) {
    if (res.headersSent) return;
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    let cfg: LogbookConfig;
    try {
        cfg = readConfig();
    } catch (err) {
        sendError(res, 500, -32000, (err as Error).message);
        return;
    }

    // Bearer auth (skip only if explicitly disabled for local testing).
    const authDisabled = process.env.MCP_DISABLE_AUTH === 'true';
    if (!authDisabled) {
        const header = req.headers.authorization ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
        if (!token || token !== cfg.bearerToken) {
            sendError(res, 401, -32001, 'Unauthorized');
            return;
        }
    }

    if (req.method !== 'POST') {
        // GET/DELETE are used by the streaming/session transport; stateless mode
        // only needs POST. Reject others cleanly.
        sendError(res, 405, -32000, 'Method not allowed. Use POST.');
        return;
    }

    const server = buildServer(cfg);
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true,
    });

    res.on('close', () => {
        void transport.close();
        void server.close();
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        sendError(res, 500, -32603, `Internal error: ${(err as Error).message}`);
    }
}
