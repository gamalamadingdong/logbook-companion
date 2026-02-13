import axios from 'axios';
import type { C2Profile, C2Response, C2Result, C2ResultDetail, C2Stroke } from './concept2.types';

const BASE_URL = 'https://log.concept2.com/api';
import { supabase } from '../services/supabase';

export const concept2Client = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Helper: Clear local tokens AND database tokens
async function clearAllTokens() {
    // Clear localStorage
    localStorage.removeItem('concept2_token');
    localStorage.removeItem('concept2_refresh_token');
    localStorage.removeItem('concept2_expires_at');

    // Clear database tokens so they don't get restored on next login
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('user_integrations').update({
                concept2_token: null,
                concept2_refresh_token: null,
                concept2_expires_at: null
            }).eq('user_id', user.id);
        }
    } catch (err) {
        console.error('Failed to clear C2 tokens from database:', err);
    }

    // Dispatch reconnect-required event for UI to handle
    window.dispatchEvent(new CustomEvent('concept2-reconnect-required'));
}

// Helper: Refresh the access token using the refresh token
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(refreshToken: string): Promise<string> {
    // Deduplicate requests in the SAME tab
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        // Deduplicate requests ACROSS tabs using Web Locks API
        // This ensures only one tab attempts the HTTP refresh at a time
        return navigator.locks.request('concept2_refresher_lock', async () => {
            // 1. Check if token was updated by another tab while we were waiting for the lock
            const currentStoredRefresh = localStorage.getItem('concept2_refresh_token');
            const currentStoredToken = localStorage.getItem('concept2_token');
            const currentExpiresAt = localStorage.getItem('concept2_expires_at');

            // If the refresh token changed, or if the expiry is now well in the future, return the stored token
            const isFresh = currentExpiresAt && (new Date(currentStoredRefresh ? currentExpiresAt : '').getTime() > Date.now() + 5 * 60 * 1000);

            if ((currentStoredRefresh && currentStoredRefresh !== refreshToken) || (isFresh && currentStoredToken)) {
                if (currentStoredToken) return currentStoredToken;
            }

            // 2. Proceed with actual Network Refresh
            const clientId = import.meta.env.VITE_CONCEPT2_CLIENT_ID;
            const clientSecret = import.meta.env.VITE_CONCEPT2_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                throw new Error("Missing Concept2 Client ID or Secret in environment variables.");
            }

            const params = new URLSearchParams();
            params.append('client_id', clientId);
            params.append('client_secret', clientSecret);
            params.append('grant_type', 'refresh_token');
            // Use the LATEST refresh token if possible, though 'refreshToken' arg is usually it
            params.append('refresh_token', refreshToken);
            // Explicitly request the scopes we want. This handles cases where:
            // 1. The original token had scopes that are no longer allowed (e.g. results:write)
            // 2. We want to ensure we stay within our desired permission set
            params.append('scope', 'user:read,results:read');

            try {
                const response = await axios.post('https://log.concept2.com/oauth/access_token', params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                const newToken = response.data.access_token;
                const newRefreshToken = response.data.refresh_token;

                localStorage.setItem('concept2_token', newToken);
                if (newRefreshToken) {
                    localStorage.setItem('concept2_refresh_token', newRefreshToken);
                }
                if (response.data.expires_in) {
                    const expiresAt = new Date(Date.now() + (response.data.expires_in * 1000)).toISOString();
                    localStorage.setItem('concept2_expires_at', expiresAt);
                }

                // Persist to DB async (don't block)
                supabase.auth.getUser().then(({ data: { user } }) => {
                    if (user) {
                        supabase.from('user_integrations').upsert({
                            user_id: user.id,
                            concept2_token: newToken,
                            concept2_refresh_token: newRefreshToken,
                            concept2_expires_at: response.data.expires_in
                                ? new Date(Date.now() + (response.data.expires_in * 1000)).toISOString()
                                : undefined
                        }, { onConflict: 'user_id' });
                    }
                });

                return newToken;
            } catch (error: unknown) {
                const axiosErr = error as { response?: { status?: number; data?: { error?: string; message?: string } } };
                if (axiosErr.response && axiosErr.response.status === 400) {
                    // Check ONE LAST TIME if storage updated differently
                    const finalCheckRefresh = localStorage.getItem('concept2_refresh_token');
                    if (finalCheckRefresh && finalCheckRefresh !== refreshToken) {
                        const finalCheckToken = localStorage.getItem('concept2_token');
                        if (finalCheckToken) return finalCheckToken;
                    }

                    // Only treat "invalid_grant" as truly fatal (expired/revoked refresh token).
                    // Other 400s (bad request, rate limit, temporary C2 issues) are transient.
                    const errorCode = axiosErr.response.data?.error || axiosErr.response.data?.message || '';
                    if (typeof errorCode === 'string' && errorCode.toLowerCase().includes('invalid_grant')) {
                        console.error("Fatal: Refresh token revoked/expired (invalid_grant). Clearing C2 tokens.");
                        await clearAllTokens();
                        throw new Error("FATAL_REFRESH_ERROR");
                    }

                    // Non-fatal 400 — don't nuke tokens, just throw so caller can retry later
                    console.warn("C2 token refresh got 400 (non-fatal):", errorCode);
                    throw error;
                }
                throw error;
            }
        });
    })();

    // Ensure we clear the local promise reference after it completes (success or fail)
    // so subsequent calls can start a new chain
    refreshPromise.finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

// Interceptor to add Authorization header if token exists (with proactive refresh)
concept2Client.interceptors.request.use(async (config) => {
    // Proactive expiry check
    const expiresAt = localStorage.getItem('concept2_expires_at');
    const refreshToken = localStorage.getItem('concept2_refresh_token');

    if (expiresAt && refreshToken) {
        const expiryTime = new Date(expiresAt).getTime();
        const buffer = 5 * 60 * 1000; // 5 minutes
        if (Date.now() > expiryTime - buffer) {
            try {
                const newToken = await refreshAccessToken(refreshToken);
                config.headers.Authorization = `Bearer ${newToken}`;
                config.headers['Accept'] = 'application/vnd.c2logbook.v1+json';
                return config;
            } catch (err: unknown) {
                const refreshErr = err as { message?: string; response?: { status?: number } };
                console.error('Proactive token refresh failed:', err);
                if (refreshErr.message === "FATAL_REFRESH_ERROR" || (refreshErr.response && refreshErr.response.status === 400)) {
                    // Stop the request if we know auth is dead
                    return Promise.reject(err);
                }
                // If it's network error, we might still struggle through or let 401 handler try later
            }
        }
    }

    const token = localStorage.getItem('concept2_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Accept'] = 'application/vnd.c2logbook.v1+json';
    return config;
});

// Interceptor to handle 401s (Token Refresh) and 5xx (Retry)
concept2Client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const isNetworkError = !error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');
        const isserverError = error.response && [500, 502, 503, 504, 429].includes(error.response.status);

        // RETRY LOGIC for 5xx, 429, or Network Errors (CORS/Drop)
        if (isserverError || isNetworkError) {
            originalRequest._retryCount = originalRequest._retryCount || 0;
            if (originalRequest._retryCount < 3) {
                originalRequest._retryCount++;
                const delay = Math.pow(2, originalRequest._retryCount) * 1000; // 2s, 4s, 8s

                await new Promise(resolve => setTimeout(resolve, delay));
                return concept2Client(originalRequest);
            }
        }

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('concept2_refresh_token');

            if (refreshToken) {
                try {
                    // Reuse the helper logic (which handles env vars and 400s) instead of rewriting it
                    const newToken = await refreshAccessToken(refreshToken);

                    // Update header and retry
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return concept2Client(originalRequest);

                } catch (refreshError) {
                    console.error("Token refresh failed during retry:", refreshError);
                    await clearAllTokens();
                    // Don't reject, just let it fail -> UI might redirect
                }
            }
        }
        return Promise.reject(error);
    }
);

export const getProfile = async (): Promise<C2Profile> => {
    const response = await concept2Client.get<any>('/users/me');
    // Unpack if wrapped in 'data'
    if (response.data && response.data.data) {
        return response.data.data;
    }
    return response.data;
};

export const getResults = async (userId: number | string = 'me', page?: number, params: Record<string, any> = {}): Promise<C2Response<C2Result[]>> => {
    // Construct URL
    let url = `/users/${userId}/results`;

    // Build Query Params
    const query = new URLSearchParams();
    if (page) query.append('page', page.toString());

    // Add optional filters (from, to, type)
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to); // Docs: 'to' is inclusive or exclusive? Usually inclusive ISO or date
    if (params.type) query.append('type', params.type);

    const queryString = query.toString();
    if (queryString) {
        url += `?${queryString}`;
    }

    const response = await concept2Client.get<C2Response<C2Result[]>>(url);
    return response.data;
};

export const getResultDetail = async (resultId: number): Promise<C2ResultDetail> => {
    // The "me" alias doesn't work for specific result endpoint in some APIs, 
    // but the docs say /api/users/{user}/results/{result_id}. 
    const response = await concept2Client.get<any>(`/users/me/results/${resultId}`);
    // Unpack if wrapped in 'data'
    if (response.data && response.data.data) {
        return response.data.data;
    }
    return response.data;
};

export const getStrokes = async (resultId: number): Promise<C2Stroke[]> => {
    try {
        const response = await concept2Client.get<any>(`/users/me/results/${resultId}/strokes`);
        // Docs say body: { data: [...] }
        return response.data.data;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return []; // No strokes available
        }
        throw error;
    }
};
