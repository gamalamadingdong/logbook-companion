import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/concept2Environment', () => ({ requireProductionConcept2: () => {} }));
vi.mock('./concept2LegacyCredentials', () => ({ legacyConcept2Credentials: () => ({ clientId: 'client-id', clientSecret: 'client-secret' }) }));

vi.mock('../services/supabase', () => ({
    supabase: { auth: { getUser: async () => ({ data: { user: null } }) } },
}));

import { concept2Client, getProfile } from './concept2Legacy';

const values = new Map<string, string>();
const events: string[] = [];

function unauthorized(config: InternalAxiosRequestConfig) {
    const response = { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config } as AxiosResponse;
    return new AxiosError('Unauthorized', 'ERR_BAD_RESPONSE', config, undefined, response);
}

describe('production Concept2 token refresh', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        values.clear();
        events.length = 0;
        vi.stubEnv('VITE_CONCEPT2_CLIENT_ID', 'client-id');
        vi.stubEnv('VITE_CONCEPT2_CLIENT_SECRET', 'client-secret');
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => { values.set(key, value); },
            removeItem: (key: string) => { values.delete(key); },
        });
        vi.stubGlobal('navigator', {});
        vi.stubGlobal('window', { dispatchEvent: (event: Event) => events.push(event.type) });
        values.set('concept2_token', 'old-access');
        values.set('concept2_refresh_token', 'original-refresh');
        values.set('concept2_expires_at', new Date(Date.now() + 60_000).toISOString());
    });

    it('refreshes with the original write grant and resumes profile loading', async () => {
        vi.spyOn(axios, 'post').mockImplementation(async (_url, body) => {
            const scope = new URLSearchParams(String(body)).get('scope');
            if (scope !== 'user:read,results:write') {
                throw new AxiosError('Invalid scope', 'ERR_BAD_REQUEST', undefined, undefined, {
                    data: { error: 'invalid_scope', error_description: 'Check the results:read scope.' },
                    status: 400, statusText: 'Bad Request', headers: {}, config: {},
                } as AxiosResponse);
            }
            return { data: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 604800 } };
        });
        concept2Client.defaults.adapter = async config => {
            if (config.headers.Authorization !== 'Bearer new-access') throw unauthorized(config);
            return { data: { data: { id: 42 } }, status: 200, statusText: 'OK', headers: {}, config };
        };

        await expect(getProfile()).resolves.toMatchObject({ id: 42 });
        expect(values.get('concept2_refresh_token')).toBe('new-refresh');
        expect(events).not.toContain('concept2-reconnect-required');
    });

    it('preserves the connection when refresh fails without an invalid grant', async () => {
        vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Invalid scope', 'ERR_BAD_REQUEST', undefined, undefined, {
            data: { error: 'invalid_scope', error_description: 'Check the results:read scope.' },
            status: 400, statusText: 'Bad Request', headers: {}, config: {},
        } as AxiosResponse));
        concept2Client.defaults.adapter = async config => { throw unauthorized(config); };

        await expect(getProfile()).rejects.toMatchObject({ response: { status: 401 } });
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(values.get('concept2_refresh_token')).toBe('original-refresh');
        expect(events).not.toContain('concept2-reconnect-required');
    });
});
