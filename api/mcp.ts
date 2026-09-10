// ChatGPT MCP connector for Logbook Companion (read-only training data).
//
// Transport: stateless Streamable HTTP (no session store, no Redis) — one
// McpServer + transport per request. This is the shape ChatGPT Developer Mode
// custom connectors expect over HTTPS.
//
// Auth: OAuth 2.1. Supabase Auth is the authorization server; this route is the
// resource server. Every tool call must carry a Supabase-issued access token
// (JWT) in `Authorization: Bearer <jwt>`. We verify it against Supabase's JWKS,
// then query with that token so Row Level Security scopes data to the user.
// Unauthenticated requests get a 401 pointing at our protected-resource metadata.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
    readEnv,
    searchWorkouts,
    getWorkoutDetail,
    getTrainingSummary,
    getBenchmarkHistory,
    getWeeklyTrend,
    compareTrainingPeriods,
    listBenchmarks,
    type LogbookConfig,
} from './_lib/logbook.js';
import {
    readAuthEnv,
    verifyBearer,
    challengeHeader,
    UnauthorizedError,
} from './_lib/mcpAuth.js';

export const config = { runtime: 'nodejs' };

const READ_ONLY = { readOnlyHint: true, openWorldHint: false, destructiveHint: false } as const;

function json(data: unknown) {
    return {
        structuredContent: data as Record<string, unknown>,
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
}

const dateSchema = z
    .string()
    .describe('ISO 8601 date or datetime, e.g. "2026-01-15" or "2026-01-15T00:00:00Z"');

function buildServer(cfg: LogbookConfig): McpServer {
    const server = new McpServer(
        { name: 'logbook-companion', version: '0.2.0' },
        {
            instructions:
                "Read-only access to the authenticated athlete's rowing and cross-training history from " +
                'Logbook Companion. Distances are meters, durations are seconds, pace (avg_split_500m) ' +
                'is seconds per 500m, watts is average power. Use search_workouts to find sessions, ' +
                'get_training_summary for rollups, compare_training_periods to contrast two windows, ' +
                'and get_benchmark_history for named efforts like "2000m".',
        },
    );

    server.registerTool(
        'search_workouts',
        {
            title: 'Search workouts',
            description:
                "Search the athlete's workout history with optional filters. Returns individual " +
                'sessions (rowing and cross-training) newest-first by default.',
            inputSchema: {
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
            annotations: READ_ONLY,
        },
        async (args) => json({ workouts: await searchWorkouts(cfg, args) }),
    );

    server.registerTool(
        'get_workout',
        {
            title: 'Get workout detail',
            description:
                'Get full detail for one workout by its id (UUID) or Concept2 external_id, including ' +
                'interval structure when present.',
            inputSchema: { id: z.string().describe('Workout UUID or Concept2 external_id') },
            annotations: READ_ONLY,
        },
        async ({ id }) => {
            const detail = await getWorkoutDetail(cfg, id);
            return detail ? json(detail) : json({ error: 'Workout not found', id });
        },
    );

    server.registerTool(
        'get_training_summary',
        {
            title: 'Training summary',
            description:
                'Aggregate training over a date range: session count, total distance/duration/calories, ' +
                'average HR, and breakdowns by workout type, training zone, and source.',
            inputSchema: {
                startDate: dateSchema.optional(),
                endDate: dateSchema.optional(),
                workoutType: z.string().optional(),
            },
            annotations: READ_ONLY,
        },
        async ({ startDate, endDate, workoutType }) =>
            json(await getTrainingSummary(cfg, startDate, endDate, workoutType)),
    );

    server.registerTool(
        'get_performance_trend',
        {
            title: 'Performance trend',
            description:
                'Weekly training trend over a range: sessions, distance, duration, avg watts, avg HR per ISO week.',
            inputSchema: {
                startDate: dateSchema.optional(),
                endDate: dateSchema.optional(),
                workoutType: z.string().optional(),
            },
            annotations: READ_ONLY,
        },
        async ({ startDate, endDate, workoutType }) =>
            json({ weeks: await getWeeklyTrend(cfg, startDate, endDate, workoutType) }),
    );

    server.registerTool(
        'compare_training_periods',
        {
            title: 'Compare training periods',
            description:
                'Compare two date windows (A vs B) and return a summary of each plus deltas. Useful for ' +
                'questions like "compare the 8 weeks before my best 2k with my last 8 weeks".',
            inputSchema: {
                periodAStart: dateSchema,
                periodAEnd: dateSchema,
                periodBStart: dateSchema,
                periodBEnd: dateSchema,
                workoutType: z.string().optional(),
            },
            annotations: READ_ONLY,
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

    server.registerTool(
        'get_benchmark_history',
        {
            title: 'Benchmark history',
            description:
                'History of a named benchmark effort identified by canonical name, e.g. "2000m", "5000m", ' +
                '"6000m", "30:00". Returns each attempt with date, pace, watts, and HR, newest first.',
            inputSchema: {
                benchmark: z.string().describe('Canonical workout name, e.g. "2000m" or "30:00"'),
                limit: z.number().int().min(1).max(200).optional(),
            },
            annotations: READ_ONLY,
        },
        async ({ benchmark, limit }) => json({ attempts: await getBenchmarkHistory(cfg, benchmark, limit ?? 50) }),
    );

    server.registerTool(
        'list_benchmarks',
        {
            title: 'List benchmarks',
            description:
                'List the distinct benchmark/workout canonical names the athlete has logged, with attempt ' +
                'counts. Use this to discover what benchmarks exist before calling get_benchmark_history.',
            inputSchema: {},
            annotations: READ_ONLY,
        },
        async () => json({ benchmarks: await listBenchmarks(cfg) }),
    );

    return server;
}

function sendJsonRpcError(res: VercelResponse, status: number, code: number, message: string, wwwAuth?: string) {
    if (res.headersSent) return;
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    if (wwwAuth) res.setHeader('WWW-Authenticate', wwwAuth);
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    // Environment.
    let env: ReturnType<typeof readEnv>;
    let authEnv: ReturnType<typeof readAuthEnv>;
    try {
        env = readEnv();
        authEnv = readAuthEnv();
    } catch (err) {
        sendJsonRpcError(res, 500, -32000, (err as Error).message);
        return;
    }

    // Verify the OAuth access token (unless explicitly disabled for local dev).
    const authDisabled = process.env.MCP_DISABLE_AUTH === 'true';
    let accessToken = 'local-dev';
    if (!authDisabled) {
        try {
            const verified = await verifyBearer(req.headers.authorization, authEnv);
            accessToken = verified.token;
        } catch (err) {
            if (err instanceof UnauthorizedError) {
                sendJsonRpcError(res, 401, -32001, err.message, challengeHeader(authEnv));
                return;
            }
            sendJsonRpcError(res, 500, -32603, `Auth error: ${(err as Error).message}`);
            return;
        }
    }

    if (!req.method || !['GET', 'POST', 'DELETE'].includes(req.method)) {
        sendJsonRpcError(res, 405, -32000, 'Method not allowed. Use GET, POST, or DELETE.');
        return;
    }

    const cfg: LogbookConfig = {
        supabaseUrl: env.supabaseUrl,
        anonKey: env.anonKey,
        accessToken,
    };

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
        sendJsonRpcError(res, 500, -32603, `Internal error: ${(err as Error).message}`);
    }
}
