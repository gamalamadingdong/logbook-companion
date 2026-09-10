import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import handler from '../../api/mcp';

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.MCP_SITE_URL = 'https://logbook.readyall.org';
    process.env.MCP_DISABLE_AUTH = 'true';

    server = http.createServer((req, res) => {
        void handler(req as never, res as never);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    delete process.env.MCP_DISABLE_AUTH;
    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

describe('MCP transport', () => {
    it('accepts the authenticated GET SSE discovery probe', async () => {
        await new Promise<void>((resolve, reject) => {
            const request = http.get(`${baseUrl}/api/mcp`, {
                headers: {
                    accept: 'text/event-stream',
                    'mcp-protocol-version': '2025-06-18',
                },
            }, (response) => {
                try {
                    expect(response.statusCode).toBe(200);
                    expect(response.headers['content-type']).toContain('text/event-stream');
                    response.destroy();
                    resolve();
                } catch (error) {
                    response.destroy();
                    reject(error);
                }
            });
            request.on('error', reject);
        });
    });
});
