// OAuth 2.1 Protected Resource Metadata (RFC 9728).
//
// ChatGPT / MCP clients fetch this to discover which authorization server backs
// this resource server. Served at /.well-known/oauth-protected-resource via a
// rewrite in vercel.json.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readAuthEnv, protectedResourceMetadata } from '../_lib/mcpAuth.js';

export const config = { runtime: 'nodejs' };

export default function handler(_req: VercelRequest, res: VercelResponse): void {
    res.setHeader('content-type', 'application/json');
    res.setHeader('access-control-allow-origin', '*');
    try {
        const env = readAuthEnv();
        res.setHeader('cache-control', 'public, max-age=300');
        res.statusCode = 200;
        res.end(JSON.stringify(protectedResourceMetadata(env)));
    } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: (err as Error).message }));
    }
}
